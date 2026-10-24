import {
  Attendee, attendeeCoachRoles, FragmentRefereeAllocation, Game, GameAttendeeAllocation, isReferee,
  Tournament, TournamentRefereeAllocation, WaterCarrierConflict, WaterCarrierMatch, WaterCarrierPlanning,
  waterCarrierIntervalsOverlap,
} from '../persistent-data-model';
import { HttpsError } from 'firebase-functions/v2/https';

/** Consistent read snapshot; raw attendee records never leave this server boundary. */
export interface WaterCarrierSource {
  tournament: Tournament;
  allocations: TournamentRefereeAllocation[];
  fragments: FragmentRefereeAllocation[];
  games: Game[];
  assignments: GameAttendeeAllocation[];
  attendees: Attendee[];
  actor?: Attendee;
}

/** Builds a public response with optional private caller permissions and blocking reasons. */
export function buildWaterCarrierPlanning(source: WaterCarrierSource, fragmentId?: string): WaterCarrierPlanning {
  const tournament = source.tournament;
  const current = source.allocations.filter(allocation => allocation.current === true);
  if (current.length > 1) throw new HttpsError('failed-precondition', 'Multiple current allocations.');
  const allocation = current[0];
  const fragments = allocation?.fragmentRefereeAllocations.flatMap(reference => {
    const fragment = source.fragments.find(item => item.id === reference.id && item.visible === true);
    return fragment && fragmentSlots(source, fragment).length ? [fragment] : [];
  }) ?? [];
  const selected = fragmentId ? fragments.find(fragment => fragment.id === fragmentId) : fragments[0];
  if (fragmentId && !selected) throw new HttpsError('permission-denied', 'This planning period is not public.');
  const result: WaterCarrierPlanning = {
    tournamentId: tournament.id, tournamentName: tournament.name, timeZone: tournament.timeZone || 'UTC',
    onlineEnabled: tournament.enablesModules?.includes('ONLINE_WATER_CARRIER') === true,
    printedEnabled: tournament.enablesModules?.includes('PRINTED_WATER_CARRIER') === true,
    periods: fragments.map(fragment => ({ id: fragment.id, label: periodLabel(source, fragment) })),
    selectedPeriodId: selected?.id ?? null, fields: [], timeslots: [], matches: [], actor: null,
  };
  if (!result.onlineEnabled && !result.printedEnabled) throw new HttpsError('permission-denied', 'Water carrier is disabled.');
  const canPrint = source.actor?.roles.some(role => role === 'TournamentManager' || attendeeCoachRoles.includes(role));
  if (selected && allocation && (result.onlineEnabled || canPrint)) populateSelected(result, source, selected);
  if (source.actor) result.actor = actorContext(source, result, allocation);
  return result;
}

/** Resolves only real periods, rather than expanding a missing part into the entire day. */
function fragmentSlots(source: WaterCarrierSource, fragment: FragmentRefereeAllocation) {
  const day = source.tournament.days.find(item => item.id === fragment.dayId);
  return day?.parts.filter(part => !fragment.partDayId || part.id === fragment.partDayId)
    .flatMap(part => part.timeslots) ?? [];
}

/** Labels a fragment using its configured day and part name. */
function periodLabel(source: WaterCarrierSource, fragment: FragmentRefereeAllocation): string {
  const part = source.tournament.days.find(day => day.id === fragment.dayId)?.parts
    .find(item => item.id === fragment.partDayId);
  return `Day ${fragment.dayId}${part ? ` - ${part.name || part.id}` : ''}`;
}

/** Adds only games and display data belonging to the selected visible fragment. */
function populateSelected(result: WaterCarrierPlanning, source: WaterCarrierSource,
  fragment: FragmentRefereeAllocation): void {
  const tournament = source.tournament;
  const day = tournament.days.find(day => day.id === fragment.dayId)!;
  const parts = day.parts.filter(part => !fragment.partDayId || part.id === fragment.partDayId);
  const slots = fragmentSlots(source, fragment).sort((a, b) => a.start - b.start);
  const fields = tournament.fields.filter(field => parts.some(part => part.allFieldsAvaillable
    || part.availableFieldIds.includes(field.id))).sort((a, b) => a.orderView - b.orderView);
  const games = source.games.filter(game => game.dayId === fragment.dayId
    && slots.some(slot => slot.id === game.timeslotId) && fields.some(field => field.id === game.fieldId));
  result.fields = fields.filter(field => games.some(game => game.fieldId === field.id))
    .map(field => ({ id: field.id, name: field.name }));
  result.timeslots = slots.map(slot => ({ id: slot.id, start: slot.start, end: slot.end }));
  result.matches = games.map(game => {
    const slot = slots.find(item => item.id === game.timeslotId)!;
    const division = tournament.divisions.find(item => item.id === game.divisionId);
    const teams = [game.homeTeamId, game.awayTeamId].map(id => division?.teams.find(team => team.id === id)?.name)
      .filter(Boolean).join(' / ');
    const assignments = source.assignments.filter(item => item.gameId === game.id
      && item.fragmentRefereeAllocationId === fragment.id);
    return {
      id: game.id, dayId: game.dayId, timeslotId: game.timeslotId, fieldId: game.fieldId,
      start: slot.start, end: slot.end,
      description: [division?.name, game.what, teams].filter(Boolean).join(' - '),
      backgroundColor: division?.backgroundColor || '#ffffff', fontColor: division?.fontColor || '#000000',
      referees: assignments.filter(item => isReferee(item.attendeeRole))
        .sort((a, b) => a.attendeePosition - b.attendeePosition).map(item => publicPerson(source, item.attendeeId)),
      waterCarriers: assignments.filter(item => item.attendeeRole === 'WaterCarrier')
        .map(item => publicPerson(source, item.attendeeId)).sort((a, b) => a.name.localeCompare(b.name)),
    };
  });
}

/** Projects a name without copying attendee identity/contact fields. */
function publicPerson(source: WaterCarrierSource, attendeeId: string) {
  const person = source.attendees.find(attendee => attendee.id === attendeeId)?.person;
  return { attendeeId, name: [person?.firstName, person?.lastName].filter(Boolean).join(' ') };
}

/** Computes caller-only reasons, including non-displayed current fragments, without disclosing their games. */
function actorContext(source: WaterCarrierSource, planning: WaterCarrierPlanning,
  allocation: TournamentRefereeAllocation | undefined): NonNullable<WaterCarrierPlanning['actor']> {
  const actor = source.actor!;
  const conflicts: Record<string, WaterCarrierConflict> = {};
  for (const match of planning.matches) {
    const reason = conflictForMatch(source, actor, match, allocation, planning.selectedPeriodId);
    if (reason) conflicts[match.id] = reason;
  }
  return {
    attendeeId: actor.id, canAllocate: planning.onlineEnabled && actor.roles.includes('Referee'),
    canPrint: planning.printedEnabled && (actor.roles.includes('TournamentManager')
      || actor.roles.some(role => attendeeCoachRoles.includes(role))),
    isCoach: actor.roles.some(role => attendeeCoachRoles.includes(role)), conflicts,
  };
}

/** Checks snapshot availability and current-allocation assignments for an overlapping match. */
function conflictForMatch(source: WaterCarrierSource, actor: Attendee, match: WaterCarrierMatch,
  allocation: TournamentRefereeAllocation | undefined, selectedFragmentId: string | null): WaterCarrierConflict | undefined {
  const day = source.tournament.days.find(item => item.id === match.dayId);
  const unavailable = actor.unavailabilities?.find(entry => entry.dayId === match.dayId);
  if (unavailable?.unavailability === 'TOTAL' || day?.parts.flatMap(part => part.timeslots).some(slot =>
    unavailable?.unavailableSlotIds.includes(slot.id)
      && waterCarrierIntervalsOverlap(match.start, match.end, slot.start, slot.end))) return 'Unavailable';
  for (const assignment of source.assignments) {
    if (assignment.attendeeId !== actor.id || (!isReferee(assignment.attendeeRole)
      && assignment.attendeeRole !== 'WaterCarrier')) continue;
    if (!allocation?.fragmentRefereeAllocations.some(item => item.id === assignment.fragmentRefereeAllocationId)) continue;
    if (assignment.attendeeRole === 'WaterCarrier' && assignment.gameId === match.id
      && assignment.fragmentRefereeAllocationId === selectedFragmentId) continue;
    const game = source.games.find(item => item.id === assignment.gameId);
    const slot = source.tournament.days.find(item => item.id === game?.dayId)?.parts.flatMap(part => part.timeslots)
      .find(item => item.id === game?.timeslotId);
    if (slot && waterCarrierIntervalsOverlap(match.start, match.end, slot.start, slot.end)) {
      return assignment.attendeeRole === 'WaterCarrier' ? 'Water carrier assignment' : 'Referee assignment';
    }
  }
  return undefined;
}
