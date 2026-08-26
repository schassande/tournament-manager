import { PersistentObject, WithId } from "./persistence";
import { RefereeBadgeSystem, RefereeCoachInfo, RefereeInfo } from "./referee";
import { Attendee, Team } from "./tournament";

/** 
 * Administrator of the platform/application
 * Id = email of the person
 */
export interface PlatformAdmin extends PersistentObject {
}

/**
 * Reusable identity persisted in Firestore and attached to attendees.
 */
export interface Person extends PersistentObject {
  userAuthId: string;
  firstName: string; // first name of the person
  lastName: string; // name of the person
  shortName: string; // short name of the person
  email: string; // email of the person
  search?: string; // concatenated search text built from identity fields
  regionId: string; // identifier of region of the person
  countryId: string; // identifier of country of the person
  gender?: Gender,
  photoUrl?: string;
  phone?: string; // phone of  the person
  referee? : RefereeInfo;
  refereeCoach? : RefereeCoachInfo;
}
export type AttendeeRole = 'Referee' 
  | 'Player' // player in a team
  | 'PlayerCoach' // Player and coach of a team
  | 'PlayerReferee' // Player and Referee
  | 'CoachReferee' // coach of referees
  | 'Coach' // Alias for CoachReferee
  | 'PlayerCoachReferee' // PlayerCoach and Referee
  | 'RefereeUpgrade' // manage Referee upgrades
  | 'RefereeRanker' // manager Referee ranking
  | 'RefereeCoachLeader' // leader of the referee coach
  | 'TournamentManager' // Manager of the tournament
  | 'GameAllocator'  // Manager of the game allocation
  | 'ResultManager'; // Manage game results

export type Gender = 'M' | 'F';

/**
 * Indicate if the role is a referee
 * @param attendeeRole role of a game attendee
 * @returns true is the role is a referee
 */
export function isReferee(attendeeRole: AttendeeRole): boolean {
  return attendeeRole === 'Referee'
      || attendeeRole === 'PlayerReferee'
      || attendeeRole === 'PlayerCoachReferee';
}
/**
 * Indicate if the role assigns an attendee as a referee coach on a game.
 * This includes mixed roles because the allocation UI persists a regular
 * coach assignment as `Coach`.
 * @param attendeeRole role of a game attendee
 * @returns true is the role is a referee coach
 */
export function isRefereeCoach(attendeeRole: AttendeeRole): boolean {
  return attendeeRole === 'Coach'
      || attendeeRole === 'CoachReferee';
}

/**
 * Build the denormalized search text stored on a person.
 * Empty values are ignored and non-empty values are separated with a single space.
 * @param person person identity fields used to build the search text
 * @returns search text ready to persist
 */
export function buildPersonSearch(person: Pick<Person, 'firstName' | 'lastName' | 'shortName' | 'email'>): string {
  return [person.firstName, person.lastName, person.shortName, person.email]
    .map((value) => typeof value === 'string' ? value.trim() : '')
    .filter((value) => value.length > 0)
    .join(' ');
}

export interface Region extends PersistentObject {
  name: string; // name of the region
  countries: Country[]; // countries of the region
}

export interface Country extends WithId {
  name: string; // name of the country
  shortName: string; // short name of the country
  badgeSystem?: RefereeBadgeSystem;
}

export interface Referee {
  attendee: Attendee;
  isPR: boolean;
  team?: Team;
}
export interface RefereeCoach {
  attendee: Attendee;
}

