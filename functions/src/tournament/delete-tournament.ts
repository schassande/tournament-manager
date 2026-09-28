import * as admin from 'firebase-admin';
import { CallableRequest, onCall } from 'firebase-functions/v2/https';
import { authorizeManager, requireDocumentId, verifiedIdentity } from '../identity/authorization';
import { attendeeIndexId, colAttendeeIndex } from '../persistent-data-model';

/** Tournament deletion request and final counters. */
export interface DeleteTournamentRequest { tournamentId: string; }
/** Final server deletion result; counters count documents removed by this attempt. */
export interface DeleteTournamentResponse { deletedDocuments: number; }

/** Collections whose documents are owned through tournamentId. */
export const tournamentCollections = ['game', 'game-attendee-allocation', 'tournament-referee-allocation',
  'fragment-referee-allocation', 'tournament-referee-allocation-statistics', 'fragment-referee-allocation-statistics',
  'referee-upgrade-coach-vote', 'referee-upgrade-panel-vote', 'coach-referees-ranking',
  'tournament-referee-ranking', 'fit-data', 'attendee'];

/** Authorizes the current manager/admin, deletes related documents, then the tournament. */
export async function deleteTournamentHandler(request: CallableRequest<DeleteTournamentRequest>): Promise<DeleteTournamentResponse> {
  const identity = verifiedIdentity(request);
  requireDocumentId(request.data?.tournamentId);
  const db = admin.firestore();
  const id = request.data.tournamentId;
  await db.runTransaction(tx => authorizeManager(tx, identity, id));
  let deletedDocuments = 0;
  for (const name of tournamentCollections) {
    while (true) {
      const page = await db.collection(name).where('tournamentId', '==', id).limit(150).get();
      if (page.empty) break;
      await db.runTransaction(async tx => {
        const docs = await tx.getAll(...page.docs.map(doc => doc.ref));
        const indexes: admin.firestore.DocumentReference[] = [];
        for (const doc of docs) {
          if (name === 'attendee' && doc.data()?.person?.email) {
            const index = db.collection(colAttendeeIndex).doc(attendeeIndexId(id, doc.data()!.person.email));
            if ((await tx.get(index)).data()?.attendeeId === doc.id) indexes.push(index);
          }
        }
        docs.forEach(doc => tx.delete(doc.ref));
        indexes.forEach(index => tx.delete(index));
      });
      deletedDocuments += page.size;
    }
  }
  await db.collection('tournament').doc(id).delete();
  return { deletedDocuments: deletedDocuments + 1 };
}

/** Complete tournament deletion endpoint; each attempt checks current permissions. */
export const deleteTournament = onCall({ timeoutSeconds: 540 }, deleteTournamentHandler);
