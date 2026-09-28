import { onCall } from 'firebase-functions/v2/https';
import { saveAttendeeHandler } from './mutations';

/** Authorized transactional attendee creation/update endpoint. */
export const saveAttendee = onCall(saveAttendeeHandler);
