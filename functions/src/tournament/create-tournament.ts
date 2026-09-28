import * as admin from 'firebase-admin';
import { CallableRequest, HttpsError, onCall } from 'firebase-functions/v2/https';
import { Attendee, Tournament, duplicateTimeslotIds } from '../persistent-data-model';
import { verifiedIdentity } from '../identity/authorization';
import { prepareAttendee, prepareIndexMutation, resolvePersonLink } from '../attendee/mutations';

/** Atomic tournament bootstrap payload and response. */
export interface CreateTournamentRequest { tournament: Tournament; attendee: Attendee; }

/** Creates the verified creator's tournament, initial manager, and index atomically. */
export async function createTournamentHandler(request: CallableRequest<CreateTournamentRequest>): Promise<CreateTournamentRequest> {
  const identity = verifiedIdentity(request);
  const input = request.data?.tournament;
  if (!input || input.id || typeof input.name !== 'string' || !Array.isArray(input.days)
    || input.days.some(day => !Array.isArray(day.parts)) || input.days.flatMap(duplicateTimeslotIds).length) {
    throw new HttpsError('invalid-argument', 'A new valid tournament is required.');
  }
  const db = admin.firestore();
  const tournamentRef = db.collection('tournament').doc();
  const attendeeRef = db.collection('attendee').doc();
  return db.runTransaction(async tx => {
    const attendee = prepareAttendee({ ...request.data.attendee, id: attendeeRef.id,
      tournamentId: tournamentRef.id,
      roles: [...new Set([...(request.data.attendee?.roles || []), 'TournamentManager'] as Attendee['roles'])],
      person: { ...request.data.attendee?.person, email: identity.email } as Attendee['person'],
    });
    await resolvePersonLink(tx, attendee);
    if (!attendee.person?.personId) throw new HttpsError('failed-precondition', 'Complete account registration first.');
    const owner = await tx.get(db.collection('person').doc(attendee.person.personId));
    if (owner.data()?.userAuthId !== identity.uid) throw new HttpsError('permission-denied', 'Wrong account owner.');
    const writeIndex = await prepareIndexMutation(tx, attendee);
    const tournament: Tournament = { ...input, id: tournamentRef.id, lastChange: Date.now(),
      managerEmails: [identity.email], managerAttendeeIds: [attendee.id] };
    tx.create(tournamentRef, tournament);
    tx.create(attendeeRef, attendee);
    writeIndex();
    return { tournament, attendee };
  });
}

/** Callable replacing the client-side first-manager transaction. */
export const createTournament = onCall(createTournamentHandler);
