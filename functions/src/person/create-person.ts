import * as admin from 'firebase-admin';
import {HttpsError, CallableRequest, onCall} from 'firebase-functions/v2/https';
import {buildPersonSearch, colEmailPersonId, colPerson, Gender, Person, RefereeCoachInfo, RefereeInfo} from '../persistent-data-model';
import {dateToEpoch} from '../common-persistence';
import { identityKeyComponent, normalizeIdentityEmail } from '../persistent-data-model';
import { verifiedIdentity } from '../identity/authorization';
import { linkPersonAttendees } from './link-attendees';

/** Self-registration payload; ownership is always derived from verified authentication. */
export interface CreatePersonRequest {
  person: Person;
}

/**
 * Creates the caller's profile idempotently, then links every matching attendee.
 * @param request callable payload containing the person to create
 * @returns the created persistent person
 */
export async function createPersonHandler(request: CallableRequest<CreatePersonRequest>): Promise<Person> {
  const identity = verifiedIdentity(request);
  const person = sanitizeCreatePersonRequest(request.data);
  if (normalizeIdentityEmail(person.email) !== identity.email || person.userAuthId !== identity.uid) {
    throw new HttpsError('permission-denied', 'You can only create your own verified profile.');
  }
  const firestore = admin.firestore();
  const normalizedEmail = identity.email;
  const personRef = firestore.collection(colPerson).doc();
  const saved = await firestore.runTransaction(async (transaction) => {
    const emailRef = firestore.collection(colEmailPersonId).doc(identityKeyComponent(normalizedEmail));
    const emailSnapshot = await transaction.get(emailRef);
    if (emailSnapshot.exists) {
      const existingRef = firestore.collection(colPerson).doc(emailSnapshot.data()!.personId);
      const existing = await transaction.get(existingRef);
      if (existing.data()?.userAuthId !== identity.uid || existing.data()?.email !== normalizedEmail) {
        throw new HttpsError('already-exists', 'A person already exists with this email.');
      }
      return { ...existing.data(), id: existing.id } as Person;
    }
    // Protect against a stale index and attempts to register an existing UID under a new email.
    const owned = await transaction.get(firestore.collection(colPerson).where('userAuthId', '==', identity.uid));
    if (!owned.empty) throw new HttpsError('failed-precondition', 'An existing profile requires index repair.');
    const createdPerson: Person = {
      ...person,
      id: personRef.id,
      email: normalizedEmail,
      search: buildPersonSearch({...person, email: normalizedEmail}),
      lastChange: dateToEpoch(new Date()),
    };

    transaction.set(personRef, createdPerson);

    transaction.set(emailRef, { personId: createdPerson.id });
    return createdPerson;
  });
  await linkPersonAttendees(saved);
  return saved;
}

/** Self-registration endpoint; retries resume linking without duplicating the account. */
export const createPerson = onCall({ timeoutSeconds: 540 }, createPersonHandler);

/**
 * Validate and normalize the create person payload.
 * @param data raw callable payload
 * @returns a sanitized person object ready to be persisted
 */
function sanitizeCreatePersonRequest(data: CreatePersonRequest | undefined): Person {
  if (!data || typeof data !== 'object' || !data.person || typeof data.person !== 'object') {
    throw new HttpsError('invalid-argument', 'The person payload is required.');
  }

  const input = data.person as Partial<Person>;

  const person: Person = {
    id: '',
    lastChange: 0,
    userAuthId: requireString(input.userAuthId, 'userAuthId'),
    firstName: requireString(input.firstName, 'firstName'),
    lastName: requireString(input.lastName, 'lastName'),
    shortName: requireString(input.shortName, 'shortName'),
    email: requireString(input.email, 'email').trim(),
    regionId: requireString(input.regionId, 'regionId'),
    countryId: requireString(input.countryId, 'countryId'),
  };

  const gender = optionalGender(input.gender);
  const photoUrl = optionalString(input.photoUrl);
  const phone = optionalString(input.phone);
  const referee = optionalRefereeInfo(input.referee);
  const refereeCoach = optionalRefereeCoachInfo(input.refereeCoach);

  if (gender !== undefined) person.gender = gender;
  if (photoUrl !== undefined) person.photoUrl = photoUrl;
  if (phone !== undefined) person.phone = phone;
  if (referee !== undefined) person.referee = referee;
  if (refereeCoach !== undefined) person.refereeCoach = refereeCoach;

  return person;
}

/**
 * Validate a required string property.
 * @param value property value
 * @param fieldName property name
 * @returns the validated string
 */
function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new HttpsError('invalid-argument', `The "${fieldName}" field must be a string.`);
  }

  return value;
}

/**
 * Validate an optional string property.
 * @param value property value
 * @returns the validated string or undefined
 */
function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new HttpsError('invalid-argument', 'Optional string fields must be strings.');
  }

  return value;
}

/**
 * Validate an optional gender value.
 * @param value property value
 * @returns the validated gender or undefined
 */
function optionalGender(value: unknown): Gender | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (value === 'M' || value === 'F') {
    return value;
  }

  throw new HttpsError('invalid-argument', 'The "gender" field must be "M" or "F".');
}

/**
 * Validate an optional referee info object.
 * @param value property value
 * @returns the same object when present
 */
function optionalRefereeInfo(value: unknown): RefereeInfo | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'object') {
    throw new HttpsError('invalid-argument', 'The "referee" field must be an object.');
  }

  return value as RefereeInfo;
}

/**
 * Validate an optional referee coach info object.
 * @param value property value
 * @returns the same object when present
 */
function optionalRefereeCoachInfo(value: unknown): RefereeCoachInfo | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'object') {
    throw new HttpsError('invalid-argument', 'The "refereeCoach" field must be an object.');
  }

  return value as RefereeCoachInfo;
}
