import * as admin from 'firebase-admin';
import { Request, Response, Router } from 'express';
import { HttpsError } from 'firebase-functions/v2/https';
import { Attendee, FragmentRefereeAllocation, Game, GameAttendeeAllocation, Person, Tournament,
  TournamentRefereeAllocation, WaterCarrierPlanning } from '../persistent-data-model';
import { Identity, indexedAttendee, requireDocumentId } from '../identity/authorization';
import { buildWaterCarrierPlanning } from './planning';

/** Public planning router; authentication only adds the current attendee's private context. */
export const waterCarrierRouter = Router();
waterCarrierRouter.get('/planning', readWaterCarrierPlanning);

/** Reads the entire requested planning in one transaction after checking publication. */
export async function readWaterCarrierPlanning(req: Request, res: Response): Promise<void> {
  res.set('Cache-Control', 'private, no-store');
  try {
    const tournamentId = req.query.tournamentId;
    const fragmentId = req.query.fragmentRefereeAllocationId;
    requireDocumentId(tournamentId);
    if (fragmentId !== undefined) requireDocumentId(fragmentId);
    const identity = await optionalIdentity(req);
    const planning = await loadWaterCarrierPlanning(tournamentId, fragmentId, identity);
    res.json(planning);
  } catch (error: unknown) {
    const statuses: Record<string, number> = { 'invalid-argument': 400, 'unauthenticated': 401,
      'permission-denied': 403, 'not-found': 404, 'failed-precondition': 409 };
    const status = error instanceof HttpsError ? (statuses[error.code] ?? 500) : 500;
    res.status(status).json({ error: error instanceof HttpsError ? error.message : 'Unable to load planning.' });
  }
}

/** Loads a consistent snapshot and resolves the actor exclusively through the tournament/email index. */
export async function loadWaterCarrierPlanning(tournamentId: string, fragmentId?: string,
  identity?: Identity): Promise<WaterCarrierPlanning> {
  const db = admin.firestore();
  return db.runTransaction(async (tx): Promise<WaterCarrierPlanning> => {
    const tournamentDoc = await tx.get(db.collection('tournament').doc(tournamentId));
    if (!tournamentDoc.exists) throw new HttpsError('not-found', 'Tournament not found.');
    const tournament = { ...tournamentDoc.data(), id: tournamentDoc.id } as Tournament;
    // Batch the source reads once for the entire planning, never once per displayed match.
    const collections = ['tournament-referee-allocation', 'fragment-referee-allocation', 'game',
      'game-attendee-allocation', 'attendee'];
    const snapshots = await Promise.all(collections.map(name =>
      tx.get(db.collection(name).where('tournamentId', '==', tournamentId))));
    const records = snapshots.map(snapshot => snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    let actor: Attendee | undefined;
    if (identity) {
      actor = await indexedAttendee(tx, identity, tournamentId);
      const personId = actor?.person?.personId;
      const person = personId ? (await tx.get(db.collection('person').doc(personId))).data() as Person | undefined : undefined;
      if (!person || person.userAuthId !== identity.uid || person.email !== identity.email) actor = undefined;
    }
    return buildWaterCarrierPlanning({ tournament, allocations: records[0] as TournamentRefereeAllocation[],
      fragments: records[1] as FragmentRefereeAllocation[], games: records[2] as Game[],
      assignments: records[3] as GameAttendeeAllocation[], attendees: records[4] as Attendee[], actor }, fragmentId);
  }, { readOnly: true });
}

/** Accepts anonymous reads, but never trusts an invalid or unverified supplied token. */
async function optionalIdentity(req: Request): Promise<Identity | undefined> {
  const bearer = req.get('Authorization');
  if (!bearer) return undefined;
  if (!bearer.startsWith('Bearer ')) throw new HttpsError('unauthenticated', 'A valid session is required.');
  let token: admin.auth.DecodedIdToken;
  try { token = await admin.auth().verifyIdToken(bearer.slice(7), true); }
  catch { throw new HttpsError('unauthenticated', 'A valid session is required.'); }
  if (!token.email_verified || !token.email) throw new HttpsError('permission-denied', 'A verified email is required.');
  return { uid: token.uid, email: token.email.trim().toLowerCase() };
}
