import { Attendee, colAttendee } from '@tournament-manager/persistent-data-model';
import * as admin from 'firebase-admin';
import { byIdRequired } from './common-persistence';

/**
 * It defines a cache of data used to limit the number of query to the database.
 */
export class DataCache {
  /** Cache of Referee (type is Attendee) */
  private readonly coaches: Map<string, Attendee> = new Map<string, Attendee>();
  /** Cache of Referee Coach (type is Attendee) */
  private readonly referees: Map<string, Attendee> = new Map<string, Attendee>();
  /** The database connection */
  public readonly firestore: admin.firestore.Firestore;
  public constructor(firestore: admin.firestore.Firestore) {
    this.firestore = firestore;
  }
  /**
   * Get a referee by its identifier. If the data is available from the cache the data is returned.
   * Otherwise a query is execute and the entry is added into the cache.
   * @param attendeeId identifier of the referee
   * @returns a referee
   * @throws Errorif the referee does not exist in the database
   */
  public async getReferee(attendeeId: string): Promise<Attendee> {
    let attendee: Attendee | undefined = this.referees.get(attendeeId);
    if (!attendee) {
      attendee = await byIdRequired<Attendee>(colAttendee, attendeeId, this.firestore);
      this.referees.set(attendeeId, attendee);
    }
    return attendee;
  }
  /**
   * Get a referee coach by its identifier. If the data is available from the cache the data is returned.
   * Otherwise a query is execute and the entry is added into the cache.
   * @param attendeeId identifier of the referee coach
   * @returns a referee coach
   * @throws Errorif the referee dcoach oes not exist in the database
   */
  public async getRefereeCoach(attendeeId: string): Promise<Attendee> {
    let attendee: Attendee | undefined = this.coaches.get(attendeeId);
    if (!attendee) {
      attendee = await byIdRequired<Attendee>(colAttendee, attendeeId, this.firestore);
      this.coaches.set(attendeeId, attendee);
    }
    return attendee;
  }
}
