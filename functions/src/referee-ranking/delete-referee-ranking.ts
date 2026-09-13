import * as admin from 'firebase-admin';
import { CallableRequest, HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  Attendee,
  colCoachRefereesRanking,
  colTournamentRefereeRanking,
  RankingDeletionResponse,
  RankingMaintenanceRequest,
} from '../persistent-data-model';
import { authorizeRankingCoach, validateRequest } from './maintenance';

/** Deletes children in retryable batches, then the parent; successful responses mean the cascade completed. */
export async function deleteRanking(
  request: CallableRequest<RankingMaintenanceRequest>,
): Promise<RankingDeletionResponse> {
  if (!request.auth?.token.email) throw new HttpsError('unauthenticated', 'An authenticated email is required.');
  validateRequest(request.data, false);
  const { tournamentId, tournamentRefereeRankingId, actorCoachAttendeeId } = request.data;
  const db = admin.firestore();
  const parentRef = db.collection(colTournamentRefereeRanking).doc(tournamentRefereeRankingId);
  const [parent, tournament, actor] = await db.getAll(
    parentRef, db.collection('tournament').doc(tournamentId), db.collection('attendee').doc(actorCoachAttendeeId),
  );
  const attendee = actor.data() as Attendee | undefined;
  const person = attendee?.person?.personId
    ? await db.collection('person').doc(attendee.person.personId).get() : undefined;
  authorizeRankingCoach(request, attendee, person?.data()?.email, tournament.data()?.enablesModules);
  if (!parent.exists) throw new HttpsError('not-found', 'Ranking not found.');
  if (parent.data()?.tournamentId !== tournamentId) throw new HttpsError('permission-denied', 'Wrong tournament.');
  const children = await db.collection(colCoachRefereesRanking)
    .where('tournamentRefereeRankingId', '==', tournamentRefereeRankingId).get();
  if (children.docs.some((child) => child.data().tournamentId !== tournamentId))
    throw new HttpsError('failed-precondition', 'An associated ranking has an inconsistent tournament.');
  try {
    // Keep the parent until every child batch succeeds, so retry can finish after a partial failure.
    for (let offset = 0; offset < children.size; offset += 500) {
      const batch = db.batch();
      children.docs.slice(offset, offset + 500).forEach((child) => batch.delete(child.ref));
      await batch.commit();
    }
    await parentRef.delete();
    return { deletedRankingId: tournamentRefereeRankingId, deletedCoachRankingCount: children.size };
  } catch (error: unknown) {
    console.error('Referee ranking deletion failed', { tournamentId, tournamentRefereeRankingId, error });
    throw new HttpsError('internal', 'Ranking deletion could not be completed. Retry the operation.');
  }
}

/** Authenticated standalone deletion for tournament referee coaches, including CLOSED rankings. */
export const deleteRefereeRanking = onCall<RankingMaintenanceRequest>(
  (request: CallableRequest<RankingMaintenanceRequest>): Promise<RankingDeletionResponse> => deleteRanking(request),
);
