import { onCall } from 'firebase-functions/v2/https';
import { deleteAttendeeHandler } from './mutations';

/** Authorized transactional attendee deletion endpoint. */
export const deleteAttendee = onCall(deleteAttendeeHandler);
