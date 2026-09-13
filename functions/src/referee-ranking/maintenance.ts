import * as admin from 'firebase-admin';
import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import {
  Attendee,
  CoachRefereesRanking,
  colCoachRefereesRanking,
  colTournamentRefereeRanking,
  isRankingReferee,
  RankingMaintenanceRequest,
  RankingMaintenanceResponse,
  rankingFromStorage,
  rankingToStorage,
  RemoveRankingRefereesRequest,
  StoredTournamentRefereeRanking,
} from '../persistent-data-model';

/** Rejects empty, malformed or path-like document identifiers at the callable boundary. */
function requireId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.includes('/') || value === '.' || value === '..') {
    throw new HttpsError('invalid-argument', 'Valid document identifiers are required.');
  }
}

/** Validates transport data before accessing Firestore. */
export function validateRequest(data: RankingMaintenanceRequest, removal: boolean): string[] {
  if (!data || typeof data !== 'object') throw new HttpsError('invalid-argument', 'A ranking context is required.');
  requireId(data.tournamentId);
  requireId(data.tournamentRefereeRankingId);
  requireId(data.actorCoachAttendeeId);
  if (!removal) return [];
  const ids = (data as RemoveRankingRefereesRequest).refereeAttendeeIds;
  if (!Array.isArray(ids) || !ids.length) throw new HttpsError('invalid-argument', 'Select referees to remove.');
  ids.forEach(requireId);
  return [...new Set(ids)];
}

/** Verifies a persisted coach and linked person against the callable identity and module gate. */
export function authorizeRankingCoach(
  request: CallableRequest<RankingMaintenanceRequest>,
  attendee: Attendee | undefined,
  personEmail: unknown,
  enabledModules: unknown,
): void {
  if (!attendee?.isRefereeCoach || attendee.tournamentId !== request.data.tournamentId ||
    !attendee.person?.personId || personEmail !== request.auth?.token.email ||
    !Array.isArray(enabledModules) || !enabledModules.includes('RANKING')) {
    throw new HttpsError('permission-denied', 'Ranking access requires a referee coach of this tournament.');
  }
}

/** Removes invalid references atomically across the parent, panel statistics and every owner.
 * Repair derives eligibility from persisted attendees; CLOSED repair is read-only.
 * Transaction failure, including Firestore limits, never commits a partial cleanup.
 */
export async function maintainRanking(
  request: CallableRequest<RankingMaintenanceRequest>,
  removal: boolean,
): Promise<RankingMaintenanceResponse> {
  if (!request.auth?.token.email) throw new HttpsError('unauthenticated', 'An authenticated email is required.');
  const ids = validateRequest(request.data, removal);
  const { tournamentId, tournamentRefereeRankingId, actorCoachAttendeeId } = request.data;
  const db = admin.firestore();
  const parentRef = db.collection(colTournamentRefereeRanking).doc(tournamentRefereeRankingId);
  return db.runTransaction(async (transaction: admin.firestore.Transaction): Promise<RankingMaintenanceResponse> => {
    const [parent, tournament, actor] = await transaction.getAll(
      parentRef,
      db.collection('tournament').doc(tournamentId),
      db.collection('attendee').doc(actorCoachAttendeeId),
    );
    const attendee = actor.data() as Attendee | undefined;
    if (!attendee?.isRefereeCoach || attendee.tournamentId !== tournamentId || !attendee.person?.personId) {
      throw new HttpsError('permission-denied', 'A referee coach of this tournament is required.');
    }
    const person = await transaction.get(db.collection('person').doc(attendee.person.personId));
    authorizeRankingCoach(request, attendee, person.data()?.email, tournament.data()?.enablesModules);
    if (!parent.exists) throw new HttpsError('not-found', 'Ranking not found.');
    const ranking = rankingFromStorage({ ...parent.data(), id: parent.id } as StoredTournamentRefereeRanking);
    if (ranking.tournamentId !== tournamentId) throw new HttpsError('permission-denied', 'Wrong tournament.');
    if (removal && ranking.status === 'CLOSED') throw new HttpsError('failed-precondition', 'The ranking is closed.');
    const snapshots = await transaction.get(
      db.collection(colCoachRefereesRanking).where('tournamentRefereeRankingId', '==', tournamentRefereeRankingId),
    );
    const coachRankings = snapshots.docs.map((item) => ({ ...item.data(), id: item.id }) as CoachRefereesRanking);
    if (ranking.status === 'CLOSED') return { ranking, coachRankings, changed: false };
    if (coachRankings.some((item) => item.tournamentId !== tournamentId)) {
      throw new HttpsError('failed-precondition', 'An associated ranking has an inconsistent tournament.');
    }
    if (removal && ids.some((id) => !ranking.selectedRefereeAttendeeIds.includes(id))) {
      throw new HttpsError('invalid-argument', 'Only selected referees can be removed.');
    }
    const attendees = await transaction.get(db.collection('attendee').where('tournamentId', '==', tournamentId));
    const eligible = new Set(
      attendees.docs.filter((item) => isRankingReferee(item.data() as Attendee)).map((item) => item.id),
    );
    const removed = new Set(ids);
    const selected = ranking.selectedRefereeAttendeeIds.filter((id) => eligible.has(id) && !removed.has(id));
    const retained = new Set(selected);
    const now = Date.now();
    const timestamp = new Date(now).toISOString();
    const updatedCoaches = coachRankings.map((item) => {
      const rankedRefereeAttendeeIds = item.rankedRefereeAttendeeIds.filter((id) => retained.has(id));
      return rankedRefereeAttendeeIds.length === item.rankedRefereeAttendeeIds.length
        ? item
        : {
            ...item,
            rankedRefereeAttendeeIds,
            rankingLastChange: timestamp,
            lastChange: now,
          };
    });
    const panel = ranking.panelRefereesRanking;
    const positions = panel.rankedRefereeAttendeeIds
      .map((_, index) => index)
      .filter((index) => retained.has(panel.rankedRefereeAttendeeIds[index]));
    const panelChanged = positions.length !== panel.rankedRefereeAttendeeIds.length;
    const changed =
      selected.length !== ranking.selectedRefereeAttendeeIds.length ||
      panelChanged ||
      updatedCoaches.some((item, index) => item !== coachRankings[index]);
    if (!changed) return { ranking, coachRankings, changed: false };
    const updated = {
      ...ranking,
      selectedRefereeAttendeeIds: selected,
      updatedByCoachAttendeeId: actorCoachAttendeeId,
      lastChange: now,
      panelResultState: ranking.panelResultState === 'NOT_COMPUTED' ? ('NOT_COMPUTED' as const) : ('STALE' as const),
      panelRefereesRanking: {
        ...panel,
        rankedRefereeAttendeeIds: positions.map((index) => panel.rankedRefereeAttendeeIds[index]),
        stats: positions.map((index) => panel.stats[index]),
        rankingLastChange: panelChanged ? timestamp : panel.rankingLastChange,
      },
    };
    // All reads and validation precede the first write. Preserve locked and unchanged records.
    transaction.set(parentRef, rankingToStorage(updated));
    updatedCoaches.forEach((item, index) => {
      if (item !== coachRankings[index]) transaction.set(snapshots.docs[index].ref, item);
    });
    return { ranking: updated, coachRankings: updatedCoaches, changed: true };
  });
}
