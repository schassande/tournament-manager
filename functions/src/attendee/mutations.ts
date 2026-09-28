import * as admin from 'firebase-admin';
import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import { Attendee, attendeeIndexId, attendeeRoleFlags, attendeeRoles, colAttendeeIndex,
  identityKeyComponent, normalizeIdentityEmail } from '../persistent-data-model';
import { authorizeManager, requireDocumentId, verifiedIdentity } from '../identity/authorization';

/** Request for a complete attendee save, with a server-generated ID for creation. */
export interface SaveAttendeeRequest { attendee: Attendee; }
/** Request identifying an attendee to delete. */
export interface DeleteAttendeeRequest { id: string; }

/** Validates the attendee contract and derives fields that confer privileges. */
export function prepareAttendee(input: Attendee): Attendee {
  if (!input || typeof input !== 'object' || !Array.isArray(input.roles)
    || input.roles.some(role => !attendeeRoles.includes(role))) {
    throw new HttpsError('invalid-argument', 'Valid attendee roles are required.');
  }
  requireDocumentId(input.tournamentId);
  if (input.id) requireDocumentId(input.id);
  if (input.person !== undefined && (!input.person || typeof input.person !== 'object')) {
    throw new HttpsError('invalid-argument', 'Invalid attendee person.');
  }
  if (input.person && ['firstName', 'lastName', 'shortName', 'regionId', 'countryId']
    .some(key => typeof (input.person as unknown as Record<string, unknown>)[key] !== 'string')) {
    throw new HttpsError('invalid-argument', 'Attendee identity fields must be strings.');
  }
  if (input.person?.email !== undefined && typeof input.person.email !== 'string') {
    throw new HttpsError('invalid-argument', 'Invalid attendee email.');
  }
  const roles = [...new Set(input.roles)];
  const attendee = { ...input, roles, ...attendeeRoleFlags(roles), lastChange: Date.now() };
  if (input.person) attendee.person = { ...input.person,
    ...(input.person.email !== undefined ? { email: normalizeIdentityEmail(input.person.email) } : {}) };
  const email = attendee.person?.email;
  if (email && (!/^[^\s@]+@[^\s@]+$/.test(email)
    || Buffer.byteLength(attendeeIndexId(attendee.tournamentId, email), 'utf8') > 1500)) {
    throw new HttpsError('invalid-argument', 'Invalid or oversized attendee email.');
  }
  return attendee;
}

/** Resolves a current account inside the mutation transaction; validates changed explicit links. */
export async function resolvePersonLink(tx: admin.firestore.Transaction, attendee: Attendee,
  previous?: Attendee): Promise<void> {
  if (!attendee.person) return;
  const db = admin.firestore();
  const email = attendee.person.email || '';
  const supplied = attendee.person.personId;
  const changed = supplied && supplied !== previous?.person?.personId;
  if (changed) {
    requireDocumentId(supplied);
    const person = await tx.get(db.collection('person').doc(supplied));
    if (!person.exists || normalizeIdentityEmail(person.data()?.email || '') !== email) {
      throw new HttpsError('invalid-argument', 'The linked Person must have the attendee email.');
    }
  }
  if (!email) {
    delete attendee.person.personId;
    return;
  }
  const lookup = await tx.get(db.collection('email_personid').doc(identityKeyComponent(email)));
  const personId: unknown = lookup.data()?.personId;
  if (typeof personId === 'string') {
    const person = await tx.get(db.collection('person').doc(personId));
    if (person.exists && normalizeIdentityEmail(person.data()?.email || '') === email) {
      attendee.person.personId = personId;
      return;
    }
  }
  if (email !== normalizeIdentityEmail(previous?.person?.email || '') && !changed) delete attendee.person.personId;
}

/** Reads index ownership before writes, rejecting collisions and preserving another owner's entry. */
export async function prepareIndexMutation(tx: admin.firestore.Transaction, attendee: Attendee,
  previous?: Attendee): Promise<() => void> {
  const db = admin.firestore();
  const oldEmail = previous?.person?.email;
  const newEmail = attendee.person?.email;
  const oldRef = oldEmail ? db.collection(colAttendeeIndex).doc(attendeeIndexId(attendee.tournamentId, oldEmail)) : null;
  const newRef = newEmail ? db.collection(colAttendeeIndex).doc(attendeeIndexId(attendee.tournamentId, newEmail)) : null;
  const oldSnapshot = oldRef ? await tx.get(oldRef) : undefined;
  const newSnapshot = newRef ? await tx.get(newRef) : undefined;
  if (newSnapshot?.exists && newSnapshot.data()?.attendeeId !== attendee.id) {
    throw new HttpsError('already-exists', 'This email already belongs to an attendee in this tournament.');
  }
  return () => {
    if (oldRef && oldRef.path !== newRef?.path && oldSnapshot?.data()?.attendeeId === attendee.id) tx.delete(oldRef);
    if (newRef) tx.set(newRef, { attendeeId: attendee.id });
  };
}

/** Saves an attendee and its index atomically after authorizing the persisted tournament. */
export async function saveAttendeeHandler(request: CallableRequest<SaveAttendeeRequest>): Promise<Attendee> {
  const identity = verifiedIdentity(request);
  const prepared = prepareAttendee(request.data?.attendee);
  const db = admin.firestore();
  const ref = prepared.id ? db.collection('attendee').doc(prepared.id) : db.collection('attendee').doc();
  return db.runTransaction(async tx => {
    const previous = (await tx.get(ref)).data() as Attendee | undefined;
    if (prepared.id && !previous) throw new HttpsError('not-found', 'Attendee not found.');
    if (previous && previous.tournamentId !== prepared.tournamentId) {
      throw new HttpsError('permission-denied', 'An attendee cannot change tournaments.');
    }
    await authorizeManager(tx, identity, prepared.tournamentId);
    const attendee = prepareAttendee({ ...prepared, id: ref.id });
    await resolvePersonLink(tx, attendee, previous);
    const writeIndex = await prepareIndexMutation(tx, attendee, previous);
    tx.set(ref, attendee);
    writeIndex();
    return attendee;
  });
}

/** Deletes an attendee and only its own index entry in a single authorized transaction. */
export async function deleteAttendeeHandler(request: CallableRequest<DeleteAttendeeRequest>): Promise<void> {
  const identity = verifiedIdentity(request);
  requireDocumentId(request.data?.id);
  const db = admin.firestore();
  await db.runTransaction(async tx => {
    const ref = db.collection('attendee').doc(request.data.id);
    const old = (await tx.get(ref)).data() as Attendee | undefined;
    if (!old) return;
    await authorizeManager(tx, identity, old.tournamentId);
    const writeIndex = await prepareIndexMutation(tx, { ...old, id: ref.id, person: undefined }, old);
    tx.delete(ref);
    writeIndex();
  });
}
