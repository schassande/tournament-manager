import {
  Attendee,
  Field,
  Game,
  GameAttendeeAllocation,
  PartDay,
  RefereeCategory,
  Timeslot,
} from '@tournament-manager/persistent-data-model';

/** Planning scope resolved from a visible allocation fragment. */
export interface PlanningScope {
  id: string;
  label: string;
  dayId: string;
  partDayId?: string;
  timeslots: Timeslot[];
  fields: Field[];
}

/** A game enriched with the display data needed by planning tabs. */
export interface PlanningGame {
  game: Game;
  field: Field;
  timeslot: Timeslot;
  divisionName: string;
  divisionBackgroundColor?: string;
  divisionFontColor?: string;
  homeTeamName: string;
  awayTeamName: string;
  referees: GameAttendeeAllocation[];
  coaches: GameAttendeeAllocation[];
}

/** Converts a referee category code into the filter label. */
export function categoryLabel(category: RefereeCategory | undefined): string {
  return (
    (
      { J: 'Junior', O: 'Open', S: 'Senior', M: 'Master' } as Record<
        string,
        string
      >
    )[category ?? ''] ?? ''
  );
}

/** Returns a stable display name for an attendee. */
export function attendeeName(attendee: Attendee): string {
  return [attendee.person?.firstName, attendee.person?.lastName]
    .filter(Boolean)
    .join(' ');
}

/** Returns whether an attendee is available for a timeslot. */
export function isAvailable(
  attendee: Attendee,
  dayId: string,
  timeslotId: string,
): boolean {
  const entry = attendee.unavailabilities?.find((item) => item.dayId === dayId);
  return (
    entry?.unavailability !== 'TOTAL' &&
    !entry?.unavailableSlotIds.includes(timeslotId)
  );
}
