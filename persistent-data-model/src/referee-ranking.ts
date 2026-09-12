import { PersistentObject } from './persistence';
import { Attendee } from './tournament';

/** Editable panel membership and threshold; omissions preserve their stored values. */
export interface RankingCoachChanges {
  selectedCoachAttendeeIds?: string[];
  voteMajority?: number;
}

/** Editable Referees-tab fields; omissions leave persisted values untouched. */
export interface RankingRefereeChanges {
  name?: string;
  nbRefereesToRank?: number;
  selectedRefereeAttendeeIds?: string[];
}

/** Authenticated maintenance context; the server verifies the actor's person identity. */
export interface RankingMaintenanceRequest {
  tournamentId: string;
  tournamentRefereeRankingId: string;
  actorCoachAttendeeId: string;
}

/** Atomic removal request for one or more currently selected referees. */
export interface RemoveRankingRefereesRequest extends RankingMaintenanceRequest {
  refereeAttendeeIds: string[];
}

/** Committed parent and all associated individual records, in application representation. */
export interface RankingMaintenanceResponse {
  ranking: TournamentRefereeRanking;
  coachRankings: CoachRefereesRanking[];
  changed: boolean;
}

/** Full-time referee eligibility shared by selection and server-side maintenance. */
export function isRankingReferee(attendee: Attendee): boolean {
  return attendee.isReferee === true && !attendee.player?.teamId && !attendee.roles?.includes('PlayerReferee');
}

/** Firestore collection containing tournament ranking configurations. */
export const colTournamentRefereeRanking = 'tournament-referee-ranking';
/** Firestore collection containing individual coach rankings. */
export const colCoachRefereesRanking = 'coach-referees-ranking';

/** Supported phases; CLOSED is final except for explicit deletion. */
export type RefereeRankingStatus = 'CONFIGURE' | 'INDIVIDUAL_RANKING' | 'PANEL_RANKING' | 'CLOSED';
/** Business freshness of a manually computed result, not an edit revision. */
export type PanelResultState = 'NOT_COMPUTED' | 'CURRENT' | 'STALE';

/** Ordered referee attendee IDs and ISO time of their latest ranking change. */
export interface RefereesRanking {
  rankingLastChange: string;
  rankedRefereeAttendeeIds: string[];
}

/** Panel result with frozen nomination histories aligned by referee position. */
export interface PanelRefereesRanking extends RefereesRanking {
  stats: number[][];
}

/** Configuration, lifecycle and panel result of one named tournament ranking. */
export interface TournamentRefereeRanking extends PersistentObject {
  name: string;
  tournamentId: string;
  selectedRefereeAttendeeIds: string[];
  selectedCoachAttendeeIds: string[];
  nbRefereesToRank: number;
  voteMajority: number;
  status: RefereeRankingStatus;
  panelRefereesRanking: PanelRefereesRanking;
  panelResultState: PanelResultState;
  updatedByCoachAttendeeId: string;
}

/** One owner's ranking, uniquely identified by its parent ranking and coach. */
export interface CoachRefereesRanking extends RefereesRanking, PersistentObject {
  tournamentRefereeRankingId: string;
  tournamentId: string;
  coachAttendeeId: string;
  locked: boolean;
}

/** Map wrapper allowing nomination arrays to be stored in Firestore Standard. */
export interface StoredPanelStatsRow {
  ranks: number[];
}

/** Storage representation; application code uses PanelRefereesRanking instead. */
export interface StoredTournamentRefereeRanking extends Omit<TournamentRefereeRanking, 'panelRefereesRanking'> {
  panelRefereesRanking: RefereesRanking & { stats: StoredPanelStatsRow[] };
}

/** Builds a collision-free document ID; encoded components never contain the separator. */
export function coachRefereesRankingId(rankingId: string, coachAttendeeId: string): string {
  if (!rankingId || !coachAttendeeId) throw new Error('Ranking and coach identifiers are required.');
  return `${encodeURIComponent(rankingId)}|${encodeURIComponent(coachAttendeeId)}`;
}

/** Creates the unsaved initial configuration using the agreed empty-panel defaults. */
export function createTournamentRefereeRanking(
  tournamentId: string,
  coachAttendeeId: string,
  name: string,
): TournamentRefereeRanking {
  if (!tournamentId || !coachAttendeeId || !name.trim()) throw new Error('A tournament, coach and name are required.');
  return {
    id: '',
    lastChange: 0,
    tournamentId,
    name: name.trim(),
    selectedRefereeAttendeeIds: [],
    selectedCoachAttendeeIds: [],
    nbRefereesToRank: 15,
    voteMajority: 1,
    status: 'CONFIGURE',
    panelRefereesRanking: { rankingLastChange: '', rankedRefereeAttendeeIds: [], stats: [] },
    panelResultState: 'NOT_COMPUTED',
    updatedByCoachAttendeeId: coachAttendeeId,
  };
}

/** Serializes nomination histories without mutating the application's result. */
export function rankingToStorage(ranking: TournamentRefereeRanking): StoredTournamentRefereeRanking {
  assertAlignedRanking(ranking.panelRefereesRanking);
  return {
    ...ranking,
    panelRefereesRanking: {
      ...ranking.panelRefereesRanking,
      rankedRefereeAttendeeIds: [...ranking.panelRefereesRanking.rankedRefereeAttendeeIds],
      stats: ranking.panelRefereesRanking.stats.map((ranks) => ({ ranks: [...ranks] })),
    },
  };
}

/** Restores the application contract; missing freshness never implies a current result. */
export function rankingFromStorage(ranking: StoredTournamentRefereeRanking): TournamentRefereeRanking {
  const result: TournamentRefereeRanking = {
    ...ranking,
    panelResultState: ranking.panelResultState ?? 'NOT_COMPUTED',
    panelRefereesRanking: {
      ...ranking.panelRefereesRanking,
      rankedRefereeAttendeeIds: [...ranking.panelRefereesRanking.rankedRefereeAttendeeIds],
      stats: ranking.panelRefereesRanking.stats.map((row) => [...row.ranks]),
    },
  };
  assertAlignedRanking(result.panelRefereesRanking);
  return result;
}

/** Lists legal next phases, excluding closure without a saved current computation. */
export function refereeRankingTransitions(ranking: TournamentRefereeRanking): RefereeRankingStatus[] {
  if (ranking.status === 'CONFIGURE') return ['INDIVIDUAL_RANKING'];
  if (ranking.status === 'INDIVIDUAL_RANKING') return ['PANEL_RANKING'];
  if (ranking.status !== 'PANEL_RANKING') return [];
  return ranking.panelResultState === 'CURRENT' && ranking.panelRefereesRanking.rankingLastChange
    ? ['INDIVIDUAL_RANKING', 'CLOSED']
    : ['INDIVIDUAL_RANKING'];
}

/** Rejects a corrupt panel payload rather than silently misaligning referee statistics. */
function assertAlignedRanking(ranking: PanelRefereesRanking): void {
  if (ranking.rankedRefereeAttendeeIds.length !== ranking.stats.length) {
    throw new Error('Panel referee IDs and statistics must have matching lengths.');
  }
}
