import * as admin from 'firebase-admin';
import { CallableRequest, HttpsError, onCall } from 'firebase-functions/v2/https';
import { identityKeyComponent, normalizeIdentityEmail } from '../persistent-data-model';
import { platformAdmin, requireDocumentId, verifiedIdentity } from '../identity/authorization';

/** Explicit account-deletion request; self-deletion is never a generic document delete. */
export interface DeletePersonRequest { personId: string; deleteAccount: true; }

/** Removes an owned/admin-selected account directly, leaving every attendee untouched. */
export async function deletePersonHandler(request: CallableRequest<DeletePersonRequest>): Promise<void> {
  const identity = verifiedIdentity(request);
  requireDocumentId(request.data?.personId);
  if (request.data.deleteAccount !== true) throw new HttpsError('invalid-argument', 'Account deletion must be explicit.');
  const db = admin.firestore();
  const ref = db.collection('person').doc(request.data.personId);
  const account = await db.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) throw new HttpsError('not-found', 'Person not found.');
    const data = snapshot.data()!;
    const isAdmin = await platformAdmin(tx, identity);
    if (!data || (!isAdmin && data.userAuthId !== identity.uid)) {
      throw new HttpsError('permission-denied', 'Only the account owner or a platform administrator may delete it.');
    }
    if (typeof data.userAuthId !== 'string' || typeof data.email !== 'string') {
      throw new HttpsError('failed-precondition', 'Account identity requires repair.');
    }
    return { uid: data.userAuthId as string, email: data.email as string };
  });
  try {
    await admin.auth().deleteUser(account.uid);
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
  }
  await db.runTransaction(async tx => {
    const emailRef = db.collection('email_personid').doc(identityKeyComponent(normalizeIdentityEmail(account.email)));
    const lookup = await tx.get(emailRef);
    if (lookup.data()?.personId === ref.id) tx.delete(emailRef);
    tx.delete(ref);
  });
}

/** Deletes the Authentication account and Person, preserving tournament memberships. */
export const deletePerson = onCall(deletePersonHandler);
