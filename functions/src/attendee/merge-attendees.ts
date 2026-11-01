import * as admin from 'firebase-admin';
import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import {
  Attendee,
  attendeeIndexId,
  attendeeRoleFlags,
  CoachRefereesRanking,
  colAttendeeIndex,
  colCoachRefereesRanking,
  colFragmentRefereeAllocation,
  colFragmentRefereeAllocationStatistics,
  colGameAttendeeAllocation,
  colRefereeUpgradeCoachVote,
  colRefereeUpgradePanelVote,
  colTournament,
  colTournamentRefereeAllocationStatistics,
  colTournamentRefereeRanking,
  FragmentRefereeAllocation,
  FragmentRefereeAllocationStatistics,
  GameAttendeeAllocation,
  normalizeIdentityEmail,
  PersistentObject,
  RefereeUpgradeCoachVote,
  RefereeUpgradePanelVote,
  Tournament,
  TournamentRefereeAllocationStatistics,
  TournamentRefereeRanking,
} from '../persistent-data-model';
import { authorizeAttendeeMerge, requireDocumentId, verifiedIdentity } from '../identity/authorization';


/** Runs the attendee merge and every collection migration in one Firestore transaction.
 * @param request Authenticated callable request with tournament, attendee IDs, and email.
 * @returns The retained attendee after the transaction commits.
 */
export async function mergeAttendees(request: CallableRequest<MergeAttendeesV2Request>): Promise<Attendee> {
  const identity = verifiedIdentity(request);
  requireDocumentId(request.data?.tournamentId);
  requireDocumentId(request.data?.targetAttendeeId);
  requireDocumentId(request.data?.sourceAttendeeId);
  if (typeof request.data?.proposedEmail !== 'string') throw new HttpsError('invalid-argument', 'A proposed email is required.');
  const db = admin.firestore();
  return db.runTransaction(async tx => {
    await authorizeAttendeeMerge(tx, identity, request.data.tournamentId);

    const sourceRef = db.collection('attendee').doc(request.data.sourceAttendeeId);
    const targetRef = db.collection('attendee').doc(request.data.targetAttendeeId);
    const [sourceSnap, targetSnap] = await Promise.all([tx.get(sourceRef), tx.get(targetRef)]);
    if (!sourceSnap.exists) throw new HttpsError('not-found', 'Attendee to merge was not found.');
    if (!targetSnap.exists || sourceSnap.id === targetSnap.id) throw new HttpsError('not-found', 'Target attendee was not found.');
    const source = { ...(sourceSnap.data() as Attendee), id: sourceSnap.id };
    const target = { ...(targetSnap.data() as Attendee), id: targetSnap.id };
    if (source.tournamentId !== request.data.tournamentId || source.tournamentId !== target.tournamentId) {
      throw new HttpsError('invalid-argument', 'Attendee tournament mismatch.');
    }
    const sourceRoles = attendeeRoleFlags(source.roles);
    const targetRoles = attendeeRoleFlags(target.roles);
    if (sourceRoles.isReferee && targetRoles.isReferee) {
      throw new HttpsError('already-exists', 'Two referees cannot share the same email.');
    }
    if (sourceRoles.isRefereeCoach && targetRoles.isRefereeCoach) {
      throw new HttpsError('already-exists', 'Two referee coaches cannot share the same email.');
    }
    const email = normalizeIdentityEmail(request.data.proposedEmail);
    if (!email || email !== normalizeIdentityEmail(source.person?.email ?? '')) {
      throw new HttpsError('failed-precondition', 'The attendees do not have the same email.');
    }
    // merge attendee into target
    const merged = combineAttendees(target, source, email);

    // update attendeeId into the model
    const context: RefContext = { 
      db, 
      tx, 
      tournamentId: source.tournamentId, 
      sourceId: source.id, 
      targetId: target.id 
    };
    const writes = (await Promise.all([
      replaceAttendeeInTournament(context),
      replaceAttendeeInRefereeAllocators(context),
      replaceAttendeeInGameAttendeeAllocation(context),
      replaceAttendeeInTournamentAllocationStatistics(context),
      replaceAttendeeInFragmentAllocationStatistics(context),
      replaceAttendeeInRefereeUpgradeCoachVotes(context),
      replaceAttendeeInRefereeUpgradePanelVotes(context),
      replaceAttendeeInTournamentRefereeRankings(context),
      replaceAttendeeInCoachRefereesRankings(context),
      mergeAttendeeIndex(context, source.person?.email, target.person?.email,
        normalizeIdentityEmail(merged.person?.email ?? '') || undefined,
      )
    ])).flat();

    // write merged attendee
    tx.set(targetSnap.ref, merged);

    // Push all writes of the model
    for (const write of writes) {
      if (write.delete) 
        tx.delete(write.ref);
      else if (write.data && write.ref) 
        tx.set(write.ref, { ...write.data, lastChange: Date.now() });
    }

    // delete source attendee
    tx.delete(sourceSnap.ref);

    return merged;
  });
}


/** Plans manager attendee ID changes in tournament.
 * @param c Transaction context containing the tournament and attendee IDs.
 * @returns One write only when managerAttendeeIds changed.
 */
async function replaceAttendeeInTournament(c: RefContext): Promise<PendingWrite[]> {
  const ref = c.db.collection(colTournament).doc(c.tournamentId);
  const snap = await c.tx.get(ref);
  if (!snap.exists) throw new HttpsError('not-found', 'Tournament not found.');
  const data = snap.data()! as Tournament;
  let changed = false;
  changed = replaceIdInArray(data, 'managerAttendeeIds', c.sourceId, c.targetId) || changed;
  return changed ? [{ ref, data }] : [];
}

/**
 * Replaces attendeeId in fragment-referee-allocation.
 * FragmentRefereeAllocation.refereeAllocatorAttendeeIds
 * FragmentRefereeAllocation.refereeCoachAllocatorAttendeeIds
 * @param c Transaction context containing the tournament and attendee IDs.
 * @returns Field updates only for documents whose referee allocator list changed.
 */
async function replaceAttendeeInRefereeAllocators(c: RefContext): Promise<PendingWrite[]> {
  return forEachByTournament<FragmentRefereeAllocation>(c, colFragmentRefereeAllocation, (c, data) => {
    let changed = false;
    changed = replaceIdInArray(data, 'refereeAllocatorAttendeeIds', c.sourceId, c.targetId) || changed;
    changed = replaceIdInArray(data, 'refereeCoachAllocatorAttendeeIds', c.sourceId, c.targetId) || changed;
    return changed;
  });
}

/** 
 * Replaces attendeeId in game-attendee-allocation.
 * @param c Transaction context containing the tournament and attendee IDs.
 * @returns Updates, deterministic rekeys, and duplicate assignment removals.
 */
async function replaceAttendeeInGameAttendeeAllocation(c: RefContext): Promise<PendingWrite[]> {
  return forEachByTournament<GameAttendeeAllocation>(c, colGameAttendeeAllocation, (c, data) => {
    return replaceIdField(data, 'attendeeId', c.sourceId, c.targetId);
  });
}

/** 
 * Replaces attendeeId in tournament-referee-allocation-statistics
 * TournamentRefereeAllocationStatistics.refereeAttendeeId
 * TournamentRefereeAllocationStatistics.tournamentStatistics.lastAttendeeAlloc
 * TournamentRefereeAllocationStatistics.tournamentStatistics.buddies.buddyAttendeeId
 * @param c Transaction context containing the tournament and attendee IDs.
 * @returns Writes only for documents with a replaced modeled reference.
 */
async function replaceAttendeeInTournamentAllocationStatistics(c: RefContext): Promise<PendingWrite[]> {
  return forEachByTournament<TournamentRefereeAllocationStatistics>(c, colTournamentRefereeAllocationStatistics, (c, data) => {
    let changed = false;
    changed = replaceIdField(data, 'refereeAttendeeId', c.sourceId, c.targetId) || changed;
    changed = replaceIdField(data.tournamentStatistics, 'lastAttendeeAlloc', c.sourceId, c.targetId) || changed;
    for (const buddy of data.tournamentStatistics.buddies) {
      changed = replaceIdField(buddy, 'buddyAttendeeId', c.sourceId, c.targetId) || changed;
    }
    return changed;
  });
}

/** 
 * Replaces attendeeId in fragment-referee-allocation-statistics
 * FragmentRefereeAllocationStatistics.refereeAttendeeId
 * FragmentRefereeAllocationStatistics.buddies.buddyAttendeeId
 * @param c Transaction context containing the tournament and attendee IDs.
 * @returns Writes only for documents with a replaced modeled reference.
 */
async function replaceAttendeeInFragmentAllocationStatistics(c: RefContext): Promise<PendingWrite[]> {
  return forEachByTournament<FragmentRefereeAllocationStatistics>(c, colFragmentRefereeAllocationStatistics, (c2, data) => {
    let changed = false;
    changed = replaceIdField(data, 'refereeAttendeeId', c.sourceId, c.targetId) || changed;
    for(const buddy of data.buddies) {
      changed = replaceIdField(buddy, 'buddyAttendeeId', c.sourceId, c.targetId) || changed;
    }
    return changed;
  });
}

/** 
 * Replaces attendeeId in referee-upgrade-coach-vote
 * @param c Transaction context containing the tournament and attendee IDs.
 * @returns Writes and source-document removals required by the merge.
 */
async function replaceAttendeeInRefereeUpgradeCoachVotes(c: RefContext): Promise<PendingWrite[]> {
  return forEachByTournament<RefereeUpgradeCoachVote>(c, colRefereeUpgradeCoachVote, (c2, data) => {
    let changed = false;
    changed = replaceIdField(data, 'coachAttendeeId', c.sourceId, c.targetId) || changed;
    changed = replaceIdField(data, 'refereeAttendeeId', c.sourceId, c.targetId) || changed;
    return changed;
  });
}

/** 
 * Replaces attendeeId in referee-upgrade-panel-vote
 * @param c Transaction context containing the tournament and attendee IDs.
 * @returns Writes and source-document removals required by the merge.
 */
async function replaceAttendeeInRefereeUpgradePanelVotes(c: RefContext): Promise<PendingWrite[]> {
  return forEachByTournament<RefereeUpgradePanelVote>(c, colRefereeUpgradePanelVote, (c2, data) => {
    let changed = false;
    changed = replaceIdField(data, 'refereeAttendeeId', c.sourceId, c.targetId) || changed;
    changed = replaceIdField(data, 'updatedByCoachAttendeeId', c.sourceId, c.targetId) || changed;
    return changed;
  });
}

/** 
 * Replaces attendeeId in tournament-referee-ranking
 * TournamentRefereeRanking.updatedByCoachAttendeeId
 * TournamentRefereeRanking.updatedCoachAttendeeId
 * TournamentRefereeRanking.selectedCoachAttendeeIds
 * TournamentRefereeRanking.selectedRefereeAttendeeIds
 * TournamentRefereeRanking.panelRefereesRanking.rankedRefereeAttendeeIds
 * @param c Transaction context containing the tournament and attendee IDs.
 * @returns Writes only for ranking documents changed by this merge.
 */
async function replaceAttendeeInTournamentRefereeRankings(c: RefContext): Promise<PendingWrite[]> {
  return forEachByTournament<TournamentRefereeRanking>(c, colTournamentRefereeRanking, (c2, data) => {
    let changed = false;
    changed = replaceIdField(data, 'updatedByCoachAttendeeId', c.sourceId, c.targetId) || changed;
    changed = replaceIdField(data, 'updatedCoachAttendeeId', c.sourceId, c.targetId) || changed;
    changed = replaceIdInArray(data, 'selectedCoachAttendeeIds', c.sourceId, c.targetId) || changed;
    changed = replaceIdInArray(data, 'selectedRefereeAttendeeIds', c.sourceId, c.targetId) || changed;
    changed = replaceIdInArray(data.panelRefereesRanking, 'rankedRefereeAttendeeIds', c.sourceId, c.targetId) || changed;
    return changed;
  });
}

/** 
 * Replaces attendeeId in coach-referees-ranking
 * CoachRefereesRanking.coachAttendeeId
 * CoachRefereesRanking.updatedByCoachAttendeeId
 * CoachRefereesRanking.rankedRefereeAttendeeIds
 * @param c Transaction context containing the tournament and attendee IDs.
 * @returns Writes, rekeys, and duplicate source-document removals.
 */
async function replaceAttendeeInCoachRefereesRankings(c: RefContext): Promise<PendingWrite[]> {
  return forEachByTournament<CoachRefereesRanking>(c, colCoachRefereesRanking, (c2, data) => {
    let changed = false;
    changed = replaceIdField(data, 'coachAttendeeId', c.sourceId, c.targetId) || changed;
    changed = replaceIdField(data, 'updatedByCoachAttendeeId', c.sourceId, c.targetId) || changed;
    changed = replaceIdInArray(data, 'rankedRefereeAttendeeIds', c.sourceId, c.targetId) || changed;
    return changed;
  });
}

/** Updates attendee-index entries affected by the merge.
 * @param c Transaction context containing tournament and attendee identifiers.
 * @param sourceEmail Email currently indexed to the deleted attendee, if present.
 * @param previousTargetEmail Email previously indexed to the retained attendee, if present.
 * @param mergedEmail Normalized email retained after the merge, if present.
 * @returns Index writes and obsolete index removals.
 */
function mergeAttendeeIndex(
  c: RefContext,
  sourceEmail?: string,
  previousTargetEmail?: string,
  mergedEmail?: string,
): PendingWrite[] {
  const collection = c.db.collection(colAttendeeIndex);
  const sourceRef = sourceEmail ? collection.doc(attendeeIndexId(c.tournamentId, sourceEmail)) : undefined;
  const previousTargetRef = previousTargetEmail ? collection.doc(attendeeIndexId(c.tournamentId, previousTargetEmail)) : undefined;
  const mergedRef = mergedEmail ? collection.doc(attendeeIndexId(c.tournamentId, mergedEmail)) : undefined;
  const writes: PendingWrite[] = [];
  if (previousTargetRef && previousTargetRef.path !== mergedRef?.path) 
    writes.push({ ref: previousTargetRef, delete: true });
  if (sourceRef && mergedRef) 
    writes.push({ ref: mergedRef, data: { attendeeId: c.targetId } });
  else if (sourceRef) 
    writes.push({ ref: sourceRef, delete: true });
  return writes;
}

/** Combines two attendees using the documented merge precedence.
 * @param target Attendee retained by the merge.
 * @param source Duplicate attendee being deleted.
 * @param email Normalized email to set on the retained attendee.
 * @returns Merged attendee with role flags recalculated.
 */
function combineAttendees(target: Attendee, source: Attendee, email: string): Attendee {
  const roles = [...new Set([...target.roles, ...source.roles])];
  const person = mergeNested(asRec(target.person), asRec(source.person));
  if (person) person['email'] = email;
  return {
    ...target,
    roles,
    ...attendeeRoleFlags(roles),
    person: person as Attendee['person'],
    player: mergeNested(asRec(target.player), asRec(source.player)) as Attendee['player'],
    referee: mergeNested(asRec(target.referee), asRec(source.referee)) as Attendee['referee'],
    refereeCoach: mergeNested(asRec(target.refereeCoach), asRec(source.refereeCoach)) as Attendee['refereeCoach'],
    unavailabilities: combineArray(target.unavailabilities, source.unavailabilities),
    roleRestrictions: combineArray(target.roleRestrictions, source.roleRestrictions),
    comments: [target.comments, source.comments].filter(value => value?.trim()).join('\n') || undefined,
    lastChange: Date.now(),
  };
}
function asRec(field:any): Record<string, unknown> | undefined {
  return field as Record<string, unknown> | undefined;
}

function combineArray<T>(a: T[] = [], b: T[] = []) {
  return [...new Map([...a, ...b].map(value => [JSON.stringify(value), value])).values()]
};

/** Merges non-empty nested values, preferring values on the retained attendee.
 * @param current Nested data from the retained attendee.
 * @param source Nested data from the attendee being absorbed.
 * @returns Merged nested data, or undefined when both values are absent.
 */
function mergeNested<T extends Record<string, unknown>>(current?: T, source?: T): T | undefined {
  if (!current && !source) return undefined;
  const result: Record<string, unknown> = { ...(source ?? {}) };
  for (const [field, value] of Object.entries(current ?? {})) {
    if (value !== undefined && value !== null && value !== '') result[field] = value;
    else if (result[field] === undefined || result[field] === null || result[field] === '') result[field] = value;
  }
  return result as T;
}

/** Input for the transactional attendee merge callable. */
export interface MergeAttendeesV2Request {
  tournamentId: string;
  targetAttendeeId: string;
  sourceAttendeeId: string;
  proposedEmail: string;
}

type RefContext = {
  db: admin.firestore.Firestore;
  tx: admin.firestore.Transaction;
  tournamentId: string;
  sourceId: string;
  targetId: string;
};

type PendingWrite = {
  ref: admin.firestore.DocumentReference;
  data?: admin.firestore.DocumentData;
  delete?: boolean;
};

/** Changes one exact attendee ID field in place.
 * @param data Mutable Firestore record.
 * @param field Known attendee ID field name.
 * @param sourceId ID to replace.
 * @param targetId Replacement ID.
 * @returns True only when the field was changed.
 */
function replaceIdField(data: any, field: string, sourceId: string, targetId: string): boolean {
  if (data && data[field] && data[field] === sourceId) {
    data[field] = targetId;
    return true;
  }
  return false;
}

/** Changes an exact attendee ID in one known array and removes duplicate IDs.
 * @param data Mutable Firestore record.
 * @param field Known attendee ID array field name.
 * @param sourceId ID to replace.
 * @param targetId Replacement ID.
 * @returns True only when the array contained the source ID.
 */
function replaceIdInArray(data: any, field: string, sourceId: string, targetId: string): boolean {
  const ids = data[field];
  if (!Array.isArray(ids) || !ids.includes(sourceId)) return false;
  data[field] = [...new Set(ids.map(id => id === sourceId ? targetId : id))];
  return true;
}

/** Applies a synchronous document merger to every document in one tournament collection.
 * @param c Transaction context with the tournament ID.
 * @param collectionName Firestore collection queried by tournamentId.
 * @param mergeFunction Callback receiving the merge context and one query document; returns its write if changed.
 * @returns Planned writes returned by the document mergers.
 */
async function forEachByTournament<T extends PersistentObject>(c: RefContext, collectionName: string,
  mergeFunction: (context: RefContext, doc: T) => boolean): Promise<PendingWrite[]> {

  const query = c.db.collection(collectionName).where('tournamentId', '==', c.tournamentId);
  const docs = (await c.tx.get(query)).docs;
  const writes: PendingWrite[] = [];
  for (const doc of docs) {
    const data: T = doc.data() as T;
    if (mergeFunction(c, data)) writes.push({ ref: doc.ref, data });
  }
  return writes;
}
