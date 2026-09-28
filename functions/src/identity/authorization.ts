import * as admin from 'firebase-admin';
import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import { Attendee, attendeeIndexId, colAttendeeIndex, normalizeIdentityEmail } from '../persistent-data-model';

/** Verified caller identity derived exclusively from Firebase Authentication. */
export interface Identity { uid: string; email: string; }

/** Rejects unauthenticated or unverified callers before any privileged access. */
export function verifiedIdentity(request: CallableRequest<unknown>): Identity {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const email = request.auth.token.email;
  if (request.auth.token.email_verified !== true || typeof email !== 'string' || !email.trim()) {
    throw new HttpsError('permission-denied', 'A verified email is required.');
  }
  return { uid: request.auth.uid, email: normalizeIdentityEmail(email) };
}

/** Validates one externally supplied Firestore document identifier. */
export function requireDocumentId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value || value.includes('/') || value === '.' || value === '..'
    || /^__.*__$/.test(value) || Buffer.byteLength(value, 'utf8') > 1500) {
    throw new HttpsError('invalid-argument', 'A valid document identifier is required.');
  }
}

/** Reads platform authority in the same transaction as a privileged mutation. */
export async function platformAdmin(tx: admin.firestore.Transaction, identity: Identity): Promise<boolean> {
  if (identity.email.includes('/')) return false;
  return (await tx.get(admin.firestore().collection('PlaformAdmin').doc(identity.email))).exists;
}

/** Resolves the current actor without relying on a mutable or missing Person link. */
export async function indexedAttendee(tx: admin.firestore.Transaction, identity: Identity,
  tournamentId: string): Promise<Attendee | undefined> {
  const db = admin.firestore();
  const index = await tx.get(db.collection(colAttendeeIndex).doc(attendeeIndexId(tournamentId, identity.email)));
  const id: unknown = index.data()?.attendeeId;
  if (typeof id !== 'string' || !id || id.includes('/')) return undefined;
  const snapshot = await tx.get(db.collection('attendee').doc(id));
  const attendee = snapshot.data() as Attendee | undefined;
  return attendee?.tournamentId === tournamentId && Array.isArray(attendee.roles) && typeof attendee.person?.email === 'string'
    && normalizeIdentityEmail(attendee.person.email) === identity.email ? { ...attendee, id } : undefined;
}

/** Authorizes management of an existing tournament through current roles. */
export async function authorizeManager(tx: admin.firestore.Transaction, identity: Identity,
  tournamentId: string): Promise<void> {
  requireDocumentId(tournamentId);
  const db = admin.firestore();
  const tournament = await tx.get(db.collection('tournament').doc(tournamentId));
  if (!tournament.exists) throw new HttpsError('not-found', 'Tournament not found.');
  const isAdmin = await platformAdmin(tx, identity);
  const actor = isAdmin ? undefined : await indexedAttendee(tx, identity, tournamentId);
  if (!isAdmin && !actor?.roles?.includes('TournamentManager')) {
    throw new HttpsError('permission-denied', 'Tournament manager access is required.');
  }
}
