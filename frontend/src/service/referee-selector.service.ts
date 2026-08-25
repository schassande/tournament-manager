import {
  Attendee,
  FragmentRefereeAllocation,
  Game,
  GeneralAllocationConfiguration,
  Referee,
  TournamentRefereeAllocation,
  findDayUnavailability,
  isSlotUnavailable,
} from '@tournament-manager/persistent-data-model';
import { Injectable, signal } from '@angular/core';
import { GameView } from '../allocation-data-model';

/** A compact match summary used by the referee selector card. */
export interface RefereeMatchSummary {
  game: GameView;
  refereeNames: string[];
}

/** Referee data shared by all selector instances on one allocation page. */
export interface RefereeSelectorEntry {
  referee: Referee;
  searchText: string;
  displayName: string;
  level: number;
  category: string;
  upgrade: boolean;
  isPlayerReferee: boolean;
  games: RefereeMatchSummary[];
}

/** Activation request sent by the allocation page after a keyboard command. */
export interface RefereeSelectorActivation {
  gameId: string;
  position: number;
  searchText: string;
  sequence: number;
}

/** Page-scoped in-memory facade shared by all referee selector instances. */
@Injectable()
export class RefereeSelectorFacade {
  private referees: (Referee | undefined)[] = [];
  private games: GameView[] = [];
  private readonly _entries = signal<RefereeSelectorEntry[]>([]);
  private preparationSequence = 0;

  /** Read-only normalized referee index consumed by the selector components. */
  readonly entries = this._entries.asReadonly();

  /** Replaces the page snapshot after loading a new allocation period. */
  setSnapshot(referees: (Referee | undefined)[], games: GameView[]): void {
    this.referees = referees;
    this.games = games;
    this.refresh();
  }

  /** Rebuilds the shared index after an in-memory allocation mutation. */
  refresh(): void {
    this._entries.set(buildRefereeSelectorIndex(this.referees, this.games));
  }

  /**
   * Prepares the index in event-loop batches so the allocation grid can render first.
   * @param referees referee snapshot for the current allocation page
   * @param games game snapshot for the current allocation page
   * @param onProgress callback receiving completed and total referee counts
   */
  async prepareAsync(
    referees: (Referee | undefined)[],
    games: GameView[],
    onProgress?: (completed: number, total: number) => void,
  ): Promise<void> {
    const sequence = ++this.preparationSequence;
    this.referees = referees;
    this.games = games;
    const entries = await buildRefereeSelectorIndexAsync(referees, games, onProgress);
    if (sequence === this.preparationSequence) this._entries.set(entries);
  }
}

/** Effective limits used by manual referee selection. */
export function effectiveAllocationConfiguration(
  fragment: FragmentRefereeAllocation | undefined,
  tournament: TournamentRefereeAllocation | undefined,
): GeneralAllocationConfiguration {
  return fragment?.generalConfig ?? tournament?.generalConfig ?? {
    maxGameInRowForReferee: 50,
    maxGameInRowForRefereeCoach: 160,
    allocateRefereeCoach: false,
    refereeCoachTwoField: false,
    nbRefereePerGame: 3,
    maxRefereeGameTimePerDay: 140,
  };
}

/** Builds the normalized period index consumed by the selector popovers. */
export function buildRefereeSelectorIndex(
  referees: (Referee | undefined)[],
  games: GameView[],
): RefereeSelectorEntry[] {
  return referees.filter((referee): referee is Referee => referee !== undefined).map((referee) => buildRefereeSelectorEntry(referee, games));
}

/** Builds the same index while yielding between small batches of referees. */
export function buildRefereeSelectorIndexAsync(
  referees: (Referee | undefined)[],
  games: GameView[],
  onProgress?: (completed: number, total: number) => void,
): Promise<RefereeSelectorEntry[]> {
  const validReferees = referees.filter((referee): referee is Referee => referee !== undefined);
  const batchSize = 8;
  const entries: RefereeSelectorEntry[] = [];
  return new Promise((resolve) => {
    let offset = 0;
    const processBatch = () => {
      const end = Math.min(offset + batchSize, validReferees.length);
      for (; offset < end; offset++) entries.push(buildRefereeSelectorEntry(validReferees[offset], games));
      onProgress?.(offset, validReferees.length);
      if (offset < validReferees.length) {
        setTimeout(processBatch, 0);
      } else {
        resolve(entries);
      }
    };
    setTimeout(processBatch, 0);
  });
}

/** Builds one normalized referee entry and its period match summaries. */
function buildRefereeSelectorEntry(referee: Referee, games: GameView[]): RefereeSelectorEntry {
    const gamesForReferee = games
      .filter((game) => game.referees.some((allocation) => allocation.attendeeAlloc.attendeeId === referee.attendee.id))
      .map((game) => ({
        game,
        refereeNames: game.referees
          .filter((allocation) => allocation.referee && allocation.attendeeAlloc.attendeeId !== referee.attendee.id)
          .map((allocation) => refereeName(allocation.referee)),
      }));
    const level = referee.attendee.referee?.badge ?? 0;
    const category = referee.attendee.referee?.category ?? '';
    const upgrade = (referee.attendee.referee?.upgrade?.badge ?? 0) > 0;
    const displayName = referee.isPR
      ? `PR ${referee.team?.name ?? ''}`.trim()
      : `${referee.attendee.person?.firstName ?? ''} ${referee.attendee.person?.lastName ?? ''}`.trim();
    const searchText = [
      referee.attendee.person?.firstName,
      referee.attendee.person?.lastName,
      referee.attendee.person?.shortName,
      referee.team?.name,
      referee.team?.divisionName,
      referee.isPR ? 'pr' : '',
      referee.isPR ? '' : `l${level}${category}${upgrade ? '*' : ''}`,
    ].filter(Boolean).join(' ').toLowerCase();
  return { referee, searchText, displayName, level, category, upgrade, isPlayerReferee: referee.isPR, games: gamesForReferee };
}

/** Splits the search expression into normalized AND terms. */
export function searchTerms(value: string): string[] {
  return value.toLowerCase().trim().split(/\s+/).filter(Boolean);
}

/** Returns whether a referee matches all ordinary and special search terms. */
export function matchesSearch(entry: RefereeSelectorEntry, value: string): boolean {
  return searchTerms(value).every((term) => {
    const levelToken = /^l([1-6])([jsom])?\*?$/.exec(term);
    if (levelToken) {
      const levelMatches = entry.level === Number(levelToken[1]);
      const categoryMatches = !levelToken[2] || entry.category.toUpperCase() === levelToken[2].toUpperCase();
      const upgradeMatches = !term.endsWith('*') || entry.upgrade;
      return levelMatches && categoryMatches && upgradeMatches;
    }
    if (term === '*') return entry.upgrade;
    return entry.searchText.includes(term);
  });
}

/** Returns whether the referee is eligible for the target game. */
export function isRefereeEligible(
  entry: RefereeSelectorEntry,
  target: GameView,
  games: GameView[],
  configuration: GeneralAllocationConfiguration,
): boolean {
  const attendee = entry.referee.attendee;
  const timeslot = target.timeslot;
  if (!timeslot) return false;
  const unavailable = findDayUnavailability(attendee.unavailabilities, target.game.dayId);
  if (isSlotUnavailable(unavailable, target.game.timeslotId)) return false;
  if (target.referees.some((allocation) => allocation.attendeeAlloc.attendeeId === attendee.id)) return false;

  const assignments = games
    .filter((game) => game.game.id !== target.game.id)
    .filter((game) => game.referees.some((allocation) => allocation.attendeeAlloc.attendeeId === attendee.id))
    .map((game) => game.timeslot ? { game, timeslot: game.timeslot } : undefined)
    .filter((value): value is { game: GameView; timeslot: NonNullable<GameView['timeslot']> } => value !== undefined);

  const sameSlot = assignments.some((assignment) =>
    assignment.game.game.dayId === target.game.dayId
    && assignment.game.game.timeslotId === target.game.timeslotId,
  );
  if (sameSlot) return false;

  const dailyPlayTime = assignments
    .filter((assignment) => assignment.game.game.dayId === target.game.dayId)
    .reduce((total, assignment) => total + assignment.timeslot.slotType.playTime, timeslot.slotType.playTime);
  if (dailyPlayTime > configuration.maxRefereeGameTimePerDay) return false;

  const sequence = [...assignments, { game: target, timeslot }]
    .sort((left, right) => left.timeslot.start - right.timeslot.start);
  let currentRun = 0;
  let previousEnd: number | undefined;
  for (const assignment of sequence) {
    if (assignment.game.game.dayId !== target.game.dayId) continue;
    if (previousEnd === undefined || assignment.timeslot.start <= previousEnd) {
      currentRun += assignment.timeslot.slotType.playTime;
    } else {
      currentRun = assignment.timeslot.slotType.playTime;
    }
    previousEnd = assignment.timeslot.end;
    if (currentRun > configuration.maxGameInRowForReferee) return false;
  }
  return true;
}

/** Formats a referee for the compact match-card participant list. */
export function refereeName(referee: Referee | undefined): string {
  if (!referee) return '';
  return referee.isPR
    ? `PR ${referee.team?.name ?? ''}`.trim()
    : `${referee.attendee.person?.firstName ?? ''} ${referee.attendee.person?.lastName ?? ''}`.trim();
}

/** Returns badge colors used by the existing referee badge system. */
export function badgeStyle(entry: RefereeSelectorEntry): { background: string; color: string } {
  const badgeSystem = entry.referee.attendee.referee?.badgeSystem;
  const badge = entry.referee.attendee.referee?.badge;
  const colors: Record<string, { background: string; color: string }> = {
    '4-1': { background: 'green', color: 'white' }, '4-2': { background: 'blue', color: 'white' },
    '4-3': { background: 'red', color: 'white' }, '4-4': { background: 'black', color: 'white' },
    '5-1': { background: '#254192', color: 'white' }, '5-2': { background: '#0394A5', color: 'white' },
    '5-3': { background: 'yellow', color: 'black' }, '5-4': { background: 'red', color: 'white' },
    '5-5': { background: 'black', color: 'white' },
    '6-1': { background: 'orange', color: 'white' }, '6-2': { background: 'violet', color: 'white' },
    '6-3': { background: 'green', color: 'white' }, '6-4': { background: 'blue', color: 'white' },
    '6-5': { background: 'red', color: 'white' }, '6-6': { background: 'black', color: 'white' },
  };
  return colors[`${badgeSystem}-${badge}`] ?? { background: '#777', color: 'white' };
}
