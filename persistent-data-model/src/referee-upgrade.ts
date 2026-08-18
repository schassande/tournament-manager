import { PersistentObject } from './persistence';

/** Possible values for an individual referee upgrade vote. */
export type UpgradeVote = 'Yes' | 'Not yet' | 'Possible' | 'DNS' | 'Voting';

/** Common identity fields shared by individual and panel upgrade decisions. */
export interface RefereeUpgradeVote {
  tournamentId: string;
  refereeAttendeeId: string;
  vote: UpgradeVote;
}

/** One referee coach's persisted evaluation of an eligible referee. */
export interface RefereeUpgradeCoachVote extends RefereeUpgradeVote, PersistentObject {
  coachAttendeeId: string;
  comments: string[];
}

/** The panel's persisted decision and follow-up assignments for one referee. */
export interface RefereeUpgradePanelVote extends RefereeUpgradeVote, PersistentObject {
  /** Attendee identity of the referee coach who last saved the panel decision. */
  updatedByCoachAttendeeId: string;
  needToSee: string[];
  needToTalk: string | null;
}

/** Build the deterministic document ID for one coach/referee vote. */
export function refereeUpgradeCoachVoteId(
  tournamentId: string,
  refereeAttendeeId: string,
  coachAttendeeId: string,
): string {
  return [tournamentId, refereeAttendeeId, coachAttendeeId].join('_');
}

/** Build the deterministic document ID for one panel/referee vote. */
export function refereeUpgradePanelVoteId(
  tournamentId: string,
  refereeAttendeeId: string,
): string {
  return [tournamentId, refereeAttendeeId].join('_');
}
