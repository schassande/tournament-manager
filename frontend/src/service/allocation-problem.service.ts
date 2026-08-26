import {
  GeneralAllocationConfiguration,
  Referee,
  RefereeCoach,
  findDayUnavailability,
  isSlotUnavailable,
} from '@tournament-manager/persistent-data-model';
import { GameView } from '../allocation-data-model';

/** Role of an attendee involved in an allocation problem. */
export type AllocationProblemRole = 'Referee' | 'Coach';

/** Stable categories used to group and render allocation problems. */
export type AllocationProblemKind =
  | 'missing-referee'
  | 'referee-unavailable'
  | 'referee-consecutive-time'
  | 'referee-daily-time'
  | 'referee-same-timeslot'
  | 'coach-unavailable'
  | 'coach-consecutive-time'
  | 'coach-same-timeslot';

/** A grid location affected by an allocation problem. */
export interface AllocationProblemLocation {
  dayId: string;
  timeslotId: string;
  fieldId?: string;
  gameId?: string;
  attendeeId?: string;
  attendeeRole?: AllocationProblemRole;
}

/** A deterministic, user-facing allocation diagnostic. */
export interface AllocationProblem {
  id: string;
  kind: AllocationProblemKind;
  message: string;
  locations: AllocationProblemLocation[];
}

/** Result returned when a coach candidate is checked for one target game. */
export interface CoachEligibilityResult {
  eligible: boolean;
  reasons: AllocationProblemKind[];
}

const REFEREE_POSITIONS_PER_GAME = 3;

/** Default configuration used when neither allocation scope defines a configuration. */
export function defaultAllocationConfiguration(): GeneralAllocationConfiguration {
  return {
    maxGameInRowForReferee: 50,
    maxGameInRowForRefereeCoach: 160,
    allocateRefereeCoach: false,
    refereeCoachTwoField: false,
    nbRefereePerGame: 3,
    maxRefereeGameTimePerDay: 140,
  };
}

/** Resolves the effective allocation configuration using fragment precedence. */
export function resolveAllocationConfiguration(
  fragment: { generalConfig?: GeneralAllocationConfiguration } | undefined,
  tournament: { generalConfig?: GeneralAllocationConfiguration } | undefined,
): GeneralAllocationConfiguration {
  return fragment?.generalConfig ?? tournament?.generalConfig ?? defaultAllocationConfiguration();
}

/** Returns whether a coach can be added to a target game. */
export function isCoachEligible(
  coach: RefereeCoach,
  target: GameView,
  games: GameView[],
  configuration: GeneralAllocationConfiguration,
): CoachEligibilityResult {
  const reasons: AllocationProblemKind[] = [];
  const targetSlot = target.timeslot;
  if (!targetSlot) return { eligible: false, reasons: ['coach-unavailable'] };

  const dayUnavailability = findDayUnavailability(coach.attendee.unavailabilities, target.game.dayId);
  if (isSlotUnavailable(dayUnavailability, target.game.timeslotId)) reasons.push('coach-unavailable');

  const assignments = coachAssignments(coach, games, target.game.id);
  const sameSlotCount = assignments.filter(({ game }) =>
    game.game.dayId === target.game.dayId && game.game.timeslotId === target.game.timeslotId,
  ).length;
  const sameSlotLimit = configuration.refereeCoachTwoField ? 2 : 1;
  if (sameSlotCount >= sameSlotLimit) reasons.push('coach-same-timeslot');

  const sequence = [...assignments, { game: target, attendeeId: coach.attendee.id }];
  if (hasConsecutiveLimitViolation(sequence, configuration.maxGameInRowForRefereeCoach)) {
    reasons.push('coach-consecutive-time');
  }
  return { eligible: reasons.length === 0, reasons };
}

/** Builds all problems currently present in the loaded allocation period. */
export function buildAllocationProblems(
  games: GameView[],
  referees: (Referee | undefined)[],
  coaches: (RefereeCoach | undefined)[],
  configuration: GeneralAllocationConfiguration,
): AllocationProblem[] {
  const problems: AllocationProblem[] = [];
  for (const game of games) addMissingRefereeProblems(problems, game);
  for (const referee of referees.filter(isDefined)) {
    const assignments = refereeAssignments(referee, games);
    addAvailabilityProblems(problems, referee.attendee.unavailabilities, assignments, 'Referee');
    addSameTimeslotProblem(problems, assignments, 'Referee', 1);
    addConsecutiveProblem(problems, assignments, 'Referee', configuration.maxGameInRowForReferee);
    addDailyTimeProblem(problems, assignments, configuration.maxRefereeGameTimePerDay);
  }
  for (const coach of coaches.filter(isDefined)) {
    const assignments = coachAssignments(coach, games);
    addAvailabilityProblems(problems, coach.attendee.unavailabilities, assignments, 'Coach');
    addSameTimeslotProblem(problems, assignments, 'Coach', configuration.refereeCoachTwoField ? 2 : 1);
    addConsecutiveProblem(problems, assignments, 'Coach', configuration.maxGameInRowForRefereeCoach);
  }
  return problems;
}

/** Returns all problem kinds affecting a given game and attendee. */
export function problemsForAttendee(
  problems: AllocationProblem[],
  gameId: string,
  attendeeId: string,
): AllocationProblem[] {
  return problems.filter(problem => problem.locations.some(location =>
    location.gameId === gameId && location.attendeeId === attendeeId,
  ));
}

function addMissingRefereeProblems(problems: AllocationProblem[], game: GameView): void {
  const count = game.referees.filter(allocation => allocation.referee?.attendee.isReferee).length;
  if (count >= REFEREE_POSITIONS_PER_GAME) return;
  const location = gameLocation(game);
  problems.push({
    id: `missing-referee:${game.game.id}`,
    kind: 'missing-referee',
    message: `Match is missing ${REFEREE_POSITIONS_PER_GAME - count} referee(s).`,
    locations: [location],
  });
}

function addAvailabilityProblems(
  problems: AllocationProblem[],
  unavailabilities: Parameters<typeof findDayUnavailability>[0],
  assignments: Assignment[],
  role: AllocationProblemRole,
): void {
  for (const assignment of assignments) {
    const entry = findDayUnavailability(unavailabilities, assignment.game.game.dayId);
    if (!isSlotUnavailable(entry, assignment.game.game.timeslotId)) continue;
    const kind = role === 'Coach' ? 'coach-unavailable' : 'referee-unavailable';
    problems.push({
      id: `${kind}:${assignment.attendeeId}:${assignment.game.game.id}`,
      kind,
      message: `${role} is unavailable for this timeslot.`,
      locations: [assignmentLocation(assignment, role)],
    });
  }
}

function addSameTimeslotProblem(
  problems: AllocationProblem[],
  assignments: Assignment[],
  role: AllocationProblemRole,
  limit: number,
): void {
  const groups = new Map<string, Assignment[]>();
  assignments.forEach(assignment => {
    const key = `${assignment.game.game.dayId}:${assignment.game.game.timeslotId}`;
    groups.set(key, [...(groups.get(key) ?? []), assignment]);
  });
  for (const [slot, group] of groups) {
    if (group.length <= limit) continue;
    const kind = role === 'Coach' ? 'coach-same-timeslot' : 'referee-same-timeslot';
    const attendeeId = group[0].attendeeId;
    problems.push({
      id: `${kind}:${attendeeId}:${slot}`,
      kind,
      message: `${role} is allocated to ${group.length} matches in the same timeslot (maximum ${limit}).`,
      locations: group.map(assignment => assignmentLocation(assignment, role)),
    });
  }
}

function addConsecutiveProblem(
  problems: AllocationProblem[],
  assignments: Assignment[],
  role: AllocationProblemRole,
  limit: number,
): void {
  const run = consecutiveViolationRun(assignments, limit);
  if (!run.length) return;
  const kind = role === 'Coach' ? 'coach-consecutive-time' : 'referee-consecutive-time';
  problems.push({
    id: `${kind}:${run[0].attendeeId}:${run.map(assignment => assignment.game.game.id).sort().join(',')}`,
    kind,
    message: `${role} exceeds the configured consecutive game-time limit of ${limit} minutes.`,
    locations: run.map(assignment => assignmentLocation(assignment, role)),
  });
}

function addDailyTimeProblem(problems: AllocationProblem[], assignments: Assignment[], limit: number): void {
  const byDay = new Map<string, Assignment[]>();
  assignments.forEach(assignment => {
    const day = assignment.game.game.dayId;
    byDay.set(day, [...(byDay.get(day) ?? []), assignment]);
  });
  for (const [dayId, dayAssignments] of byDay) {
    const total = dayAssignments.reduce((sum, assignment) => sum + playTime(assignment), 0);
    if (total <= limit) continue;
    const attendeeId = dayAssignments[0].attendeeId;
    problems.push({
      id: `referee-daily-time:${attendeeId}:${dayId}`,
      kind: 'referee-daily-time',
      message: `Referee exceeds the configured daily game-time limit of ${limit} minutes (${total} minutes).`,
      locations: dayAssignments.map(assignment => assignmentLocation(assignment, 'Referee')),
    });
  }
}

interface Assignment {
  game: GameView;
  attendeeId: string;
}

function refereeAssignments(referee: Referee, games: GameView[], excludedGameId?: string): Assignment[] {
  return games
    .filter(game => game.game.id !== excludedGameId)
    .filter(game => game.referees.some(allocation => allocation.attendeeAlloc.attendeeId === referee.attendee.id))
    .map(game => ({ game, attendeeId: referee.attendee.id }));
}

function coachAssignments(coach: RefereeCoach, games: GameView[], excludedGameId?: string): Assignment[] {
  return games
    .filter(game => game.game.id !== excludedGameId)
    .filter(game => game.coaches.some(allocation => allocation.attendeeAlloc.attendeeId === coach.attendee.id))
    .map(game => ({ game, attendeeId: coach.attendee.id }));
}

function hasConsecutiveLimitViolation(assignments: Assignment[], limit: number): boolean {
  return consecutiveViolationRun(assignments, limit).length > 0;
}

function consecutiveViolationRun(assignments: Assignment[], limit: number): Assignment[] {
  const sorted = assignments
    .filter(assignment => assignment.game.timeslot !== undefined)
    .sort((left, right) => left.game.timeslot!.start - right.game.timeslot!.start);
  let run: Assignment[] = [];
  let previousEnd: number | undefined;
  let currentMinutes = 0;
  for (const assignment of sorted) {
    const timeslot = assignment.game.timeslot!;
    if (previousEnd === undefined || timeslot.start > previousEnd) {
      run = [assignment];
      currentMinutes = playTime(assignment);
    } else {
      run = [...run, assignment];
      currentMinutes += playTime(assignment);
    }
    previousEnd = timeslot.end;
    if (currentMinutes > limit) return run;
  }
  return [];
}

function playTime(assignment: Assignment): number {
  return assignment.game.timeslot?.slotType.playTime ?? 0;
}

function gameLocation(game: GameView): AllocationProblemLocation {
  return {
    dayId: game.game.dayId,
    timeslotId: game.game.timeslotId,
    fieldId: game.game.fieldId,
    gameId: game.game.id,
  };
}

function assignmentLocation(assignment: Assignment, role: AllocationProblemRole): AllocationProblemLocation {
  return {
    ...gameLocation(assignment.game),
    attendeeId: assignment.attendeeId,
    attendeeRole: role,
  };
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
