import * as admin from 'firebase-admin';
import {HttpsError, CallableRequest, onCall} from 'firebase-functions/v2/https';
import {colEmailPersonId, colPerson, Gender, Person, RefereeCoachInfo, RefereeInfo} from '../persistent-data-model';
import {dateToEpoch} from '../common-persistence';

interface CreatePersonRequest {
  person: Person;
}

interface EmailPersonIdRecord {
  personId: string;
}

/**
 * Create a person in Firestore while enforcing email uniqueness.
 * The email index is only maintained when a non-empty email is provided.
 * @param request callable payload containing the person to create
 * @returns the created persistent person
 */
export const createPerson = onCall<CreatePersonRequest>(async (request: CallableRequest<CreatePersonRequest>): Promise<Person> => {
  const person = sanitizeCreatePersonRequest(request.data);
  const firestore = admin.firestore();
  const normalizedEmail = person.email.trim();

  return firestore.runTransaction(async (transaction) => {
    if (normalizedEmail.length > 0) {
      const emailRef = firestore.collection(colEmailPersonId).doc(normalizedEmail);
      const emailSnapshot = await transaction.get(emailRef);
      if (emailSnapshot.exists) {
        throw new HttpsError('already-exists', 'A person already exists with this email.');
      }
    }

    const personRef = firestore.collection(colPerson).doc();
    const createdPerson: Person = {
      ...person,
      id: personRef.id,
      email: normalizedEmail,
      lastChange: dateToEpoch(new Date()),
    };

    transaction.set(personRef, createdPerson);

    if (normalizedEmail.length > 0) {
      const emailRef = firestore.collection(colEmailPersonId).doc(normalizedEmail);
      const emailRecord: EmailPersonIdRecord = {personId: createdPerson.id};
      transaction.set(emailRef, emailRecord);
    }

    return createdPerson;
  });
});

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

  return {
    id: '',
    lastChange: 0,
    userAuthId: requireString(input.userAuthId, 'userAuthId'),
    firstName: requireString(input.firstName, 'firstName'),
    lastName: requireString(input.lastName, 'lastName'),
    shortName: requireString(input.shortName, 'shortName'),
    email: requireString(input.email, 'email').trim(),
    regionId: requireString(input.regionId, 'regionId'),
    countryId: requireString(input.countryId, 'countryId'),
    gender: optionalGender(input.gender),
    photoUrl: optionalString(input.photoUrl),
    phone: optionalString(input.phone),
    referee: optionalRefereeInfo(input.referee),
    refereeCoach: optionalRefereeCoachInfo(input.refereeCoach),
  };
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
