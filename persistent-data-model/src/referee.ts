import { PersistentObject, WithId } from "./persistence";
import { Attendee, RefereeCoachInfo, RefereeInfo, Team } from "./tournament";

export type RefereeCategory =
  'J' // Junior
  | 'O' // Open
  | 'S' // Senior
  | 'M'; // Master

export type AttendeeRole = 'Referee' | 'Player' | 'Coach' | 'PlayerCoach' | 'PlayerReferee'
  | 'CoachReferee' | 'PlayerCoachReferee' | 'RefereeUpgrade' | 'RefereeRanker' | 'RefereeCoachLeader'
  | 'TournamentManager' | 'GameAllocator' | 'ResultManager';

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
 * Indicate if the role is a referee coach
 * @param attendeeRole role of a game attendee
 * @returns true is the role is a referee coach
 */
export function isRefereeCoach(attendeeRole: AttendeeRole): boolean {
  return attendeeRole === 'CoachReferee';
}

export type Gender = 'M' | 'F';

export interface Person extends PersistentObject {
  userAuthId: string;
  firstName: string; // first name of the person
  lastName: string; // name of the person
  shortName: string; // short name of the person
  email: string; // email of the person
  regionId: string; // identifier of region of the person
  countryId: string; // identifier of country of the person
  gender?: Gender,
  photoUrl?: string;
  phone?: string; // phone of  the person
  referee? : RefereeInfo;
  refereeCoach? : RefereeCoachInfo;
}

export interface Referee {
  attendee: Attendee;
  isPR: boolean;
  person?: Person;
  team?: Team;
}
export interface RefereeCoach {
  attendee: Attendee;
  person?: Person;
}
export type RefereeBadgeSystem = 4 | 5 | 6;
export type RefereeCoachBadgeSystem = 3 | 4 | 5 | 6;

export interface Region extends PersistentObject {
  name: string; // name of the region
  countries: Country[]; // countries of the region
}

export interface Country extends WithId {
  name: string; // name of the country
  shortName: string; // short name of the country
  badgeSystem?: RefereeBadgeSystem;
}
