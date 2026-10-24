import { identityKeyComponent } from './attendee-index';

/** Public period selectable in water-carrier planning. */
export interface WaterCarrierPeriod {
  id: string;
  label: string;
}

/** Public assignment projection; excludes account details. */
export interface WaterCarrierPerson {
  attendeeId: string;
  name: string;
}

/** Public match projection without private attendee data or write-authorization coordinates. */
export interface WaterCarrierMatch {
  id: string;
  dayId: string;
  timeslotId: string;
  fieldId: string;
  start: number;
  end: number;
  description: string;
  backgroundColor: string;
  fontColor: string;
  referees: WaterCarrierPerson[];
  waterCarriers: WaterCarrierPerson[];
}

/** Frontend conflict reason; deliberately not an authoritative scheduling constraint. */
export type WaterCarrierConflict = 'Referee assignment' | 'Water carrier assignment' | 'Unavailable';

/** Complete single-request planning response, personalized only for the verified caller. */
export interface WaterCarrierPlanning {
  tournamentId: string;
  tournamentName: string;
  timeZone: string;
  onlineEnabled: boolean;
  printedEnabled: boolean;
  periods: WaterCarrierPeriod[];
  selectedPeriodId: string | null;
  fields: Array<{ id: string; name: string }>;
  timeslots: Array<{ id: string; start: number; end: number }>;
  matches: WaterCarrierMatch[];
  actor: null | {
    attendeeId: string;
    canAllocate: boolean;
    canPrint: boolean;
    isCoach: boolean;
    conflicts: Record<string, WaterCarrierConflict>;
  };
}

/** Stable collision-free assignment key scoped to a tournament, fragment, game and attendee. */
export function waterCarrierAllocationId(tournamentId: string, fragmentId: string, gameId: string,
  attendeeId: string): string {
  return ['WaterCarrier', tournamentId, fragmentId, gameId, attendeeId].map(identityKeyComponent).join(':');
}

/** Half-open interval overlap: consecutive matches are not concurrent. */
export function waterCarrierIntervalsOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA;
}

/** Evaluates the latest snapshot before assigning; unassignment must remain available. */
export function waterCarrierBlockingReason(planning: WaterCarrierPlanning, match: WaterCarrierMatch): string | null {
  const actor = planning.actor;
  if (!planning.onlineEnabled || !actor?.canAllocate) return 'A linked Referee account is required.';
  if (match.waterCarriers.some(person => person.attendeeId === actor.attendeeId)) return null;
  const known = actor.conflicts[match.id];
  if (known) return known;
  for (const other of planning.matches) {
    if (!waterCarrierIntervalsOverlap(match.start, match.end, other.start, other.end)) continue;
    if (other.referees.some(person => person.attendeeId === actor.attendeeId)) return 'Referee assignment';
    if (other.waterCarriers.some(person => person.attendeeId === actor.attendeeId)) return 'Water carrier assignment';
  }
  return null;
}
