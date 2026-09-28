import { Attendee } from './tournament';
import { AttendeeRole } from './person';

/** Server-owned deterministic tournament/email lookup; never stores copied roles. */
export interface AttendeeIndex { attendeeId: string; }

/** Collection containing the tournament/email identity index. */
export const colAttendeeIndex = 'attendee-index';

/** Canonical email used for identity matching; does not rewrite dots or plus suffixes. */
export function normalizeIdentityEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Escapes path and compound-key delimiters in a collision-free order. */
export function identityKeyComponent(value: string): string {
  return value.replace(/%/g, '%25').replace(/\//g, '%2F').replace(/:/g, '%3A');
}

/** Returns the index document ID; callers validate Firestore size limits. */
export function attendeeIndexId(tournamentId: string, email: string): string {
  return `${identityKeyComponent(tournamentId)}:${identityKeyComponent(normalizeIdentityEmail(email))}`;
}

/** Roles that confer referee-coach eligibility, including combined roles. */
export const attendeeCoachRoles: readonly AttendeeRole[] = ['Coach', 'CoachReferee', 'PlayerCoach', 'PlayerCoachReferee'];

/** Supported persisted attendee roles. */
export const attendeeRoles: readonly AttendeeRole[] = [
  'Referee', 'Player', 'PlayerCoach', 'PlayerReferee', 'CoachReferee', 'Coach', 'PlayerCoachReferee',
  'RefereeUpgrade', 'RefereeRanker', 'RefereeCoachLeader', 'TournamentManager', 'GameAllocator', 'ResultManager',
];

/** Derives query/UI flags from authoritative roles; clients cannot assign independent privileges. */
export function attendeeRoleFlags(roles: readonly AttendeeRole[]): Pick<Attendee,
  'isPlayer' | 'isReferee' | 'isRefereeCoach' | 'isTournamentManager'> {
  return {
    isPlayer: roles.some(role => ['Player', 'PlayerCoach', 'PlayerReferee', 'PlayerCoachReferee'].includes(role)),
    isReferee: roles.some(role => ['Referee', 'PlayerReferee', 'PlayerCoachReferee'].includes(role)),
    isRefereeCoach: roles.some(role => attendeeCoachRoles.includes(role)),
    isTournamentManager: roles.includes('TournamentManager'),
  };
}
