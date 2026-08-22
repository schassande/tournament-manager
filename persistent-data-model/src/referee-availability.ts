import {
  Day,
  PartDayUnavailability,
} from './tournament';

/**
 * Returns the unavailability entry for a day, if one exists.
 * @param entries persisted unavailability entries
 * @param dayId tournament day identifier
 */
export function findDayUnavailability(
  entries: PartDayUnavailability[] | undefined,
  dayId: string,
): PartDayUnavailability | undefined {
  return entries?.find(entry => entry.dayId === dayId);
}

/**
 * Returns whether a slot is unavailable according to a normalized entry.
 * @param entry part-day unavailability entry, if any
 * @param slotId timeslot identifier
 */
export function isSlotUnavailable(
  entry: PartDayUnavailability | undefined,
  slotId: string,
): boolean {
  return entry?.unavailability === 'TOTAL'
    || entry?.unavailableSlotIds.includes(slotId) === true;
}

/**
 * Normalizes persisted day-scoped unavailability entries against the current tournament.
 * Invalid references are removed, duplicate entries are merged, and TOTAL
 * entries take precedence over PARTIAL entries.
 * @param days current tournament days
 * @param entries persisted entries to clean
 * @returns normalized entries, or undefined when no exception remains
 */
export function normalizePartDayUnavailabilities(
  days: Day[],
  entries: PartDayUnavailability[] | undefined,
): PartDayUnavailability[] | undefined {
  if (!entries?.length) return undefined;

  const daySlotIds = new Map<string, Set<string>>();
  for (const day of days) {
    daySlotIds.set(day.id, new Set(day.parts.flatMap(part => part.timeslots.map(slot => slot.id))));
  }

  const merged = new Map<string, PartDayUnavailability>();
  for (const entry of entries) {
    const validSlotIds = daySlotIds.get(entry.dayId);
    if (!validSlotIds || validSlotIds.size === 0) continue;
    const unavailableSlotIds = unique(
      entry.unavailableSlotIds.filter(slotId => validSlotIds.has(slotId)),
    );
    const key = entry.dayId;
    const existing = merged.get(key);

    const combinedSlotIds = unique([
      ...(existing?.unavailability === 'TOTAL' ? [...validSlotIds] : existing?.unavailableSlotIds ?? []),
      ...(entry.unavailability === 'TOTAL' ? [...validSlotIds] : unavailableSlotIds),
    ]);
    if (combinedSlotIds.length === 0) continue;
    merged.set(key, {
      dayId: entry.dayId,
      unavailability: combinedSlotIds.length === validSlotIds.size ? 'TOTAL' : 'PARTIAL',
      unavailableSlotIds: combinedSlotIds.length === validSlotIds.size ? [] : combinedSlotIds,
    });
  }

  return merged.size > 0 ? [...merged.values()] : undefined;
}

/**
 * Creates a normalized entry for the selected unavailable slots in a day.
 * @param dayId tournament day identifier
 * @param day tournament containing all timeslots
 * @param unavailableSlotIds selected unavailable slot identifiers
 * @returns an entry, or undefined when all slots are available
 */
export function createDayUnavailability(
  dayId: string,
  day: Day,
  unavailableSlotIds: string[],
): PartDayUnavailability | undefined {
  const daySlotIds = day.parts.flatMap(part => part.timeslots.map(slot => slot.id));
  const validSlotIds = new Set(daySlotIds);
  const slotIds = unique(unavailableSlotIds.filter(slotId => validSlotIds.has(slotId)));
  if (slotIds.length === 0) return undefined;
  const isTotal = slotIds.length === daySlotIds.length;
  return {
    dayId,
    unavailability: isTotal ? 'TOTAL' : 'PARTIAL',
    unavailableSlotIds: isTotal ? [] : slotIds,
  };
}

/** Removes duplicate string values while preserving their first-seen order. */
function unique(values: string[]): string[] {
  return [...new Set(values)];
}
