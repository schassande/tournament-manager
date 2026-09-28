import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';
import { normalizeIdentityEmail, Person } from '../persistent-data-model';

/**
 * Idempotently links attendees selected by their persisted, normalized email.
 * Pages only matching documents; attendee writes and migration must normalize emails.
 * Each transaction rechecks identity, email, and concurrent edits.
 */
export async function linkPersonAttendees(person: Person): Promise<void> {
  const db = admin.firestore();
  let cursor: admin.firestore.QueryDocumentSnapshot | undefined;
  while (true) {
    let query = db.collection('attendee')
      .where('person.email', '==', person.email)
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(150);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    if (page.empty) return;
    await db.runTransaction(async tx => {
      const current = await tx.get(db.collection('person').doc(person.id));
      if (!current.exists || current.data()?.userAuthId !== person.userAuthId
        || current.data()?.email !== person.email) {
        throw new HttpsError('failed-precondition', 'The account is no longer available for linking.');
      }
      const attendees = await tx.getAll(...page.docs.map(doc => doc.ref));
      for (const attendee of attendees) {
        const embedded = attendee.data()?.person;
        if (typeof embedded?.email === 'string' && normalizeIdentityEmail(embedded.email) === person.email
          && embedded.personId !== person.id) {
          tx.update(attendee.ref, { 'person.personId': person.id, lastChange: Date.now() });
        }
      }
    });
    cursor = page.docs[page.docs.length - 1];
  }
}
