import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';
import { authorizeManager, Identity, requireDocumentId } from './authorization';

/** Authorizes all requested statistics inputs against one managed tournament before writes. */
export async function authorizeStatistics(identity: Identity, tournamentAllocationId: string,
  fragmentAllocationId: string, attendeeIds: string[], gameId: string): Promise<void> {
  requireDocumentId(tournamentAllocationId);
  requireDocumentId(fragmentAllocationId);
  attendeeIds.forEach(requireDocumentId);
  if (gameId) requireDocumentId(gameId);
  const db = admin.firestore();
  await db.runTransaction(async (tx: admin.firestore.Transaction): Promise<void> => {
    const [allocation, fragment] = await tx.getAll(db.collection('tournament-referee-allocation').doc(tournamentAllocationId),
      db.collection('fragment-referee-allocation').doc(fragmentAllocationId));
    const tournamentId = allocation.data()?.tournamentId;
    if (typeof tournamentId !== 'string' || fragment.data()?.tournamentId !== tournamentId) {
      throw new HttpsError('invalid-argument', 'Allocation and fragment must belong to the same tournament.');
    }
    await authorizeManager(tx, identity, tournamentId);
    const targets = attendeeIds.map(id => db.collection('attendee').doc(id));
    if (gameId) targets.push(db.collection('game').doc(gameId));
    if (targets.length) {
      const docs = await tx.getAll(...targets);
      if (docs.some(doc => doc.data()?.tournamentId !== tournamentId)) {
        throw new HttpsError('permission-denied', 'Statistics targets must belong to the managed tournament.');
      }
    }
  });
}
