import {
  Day,
  PartDay,
  PartDayUnavailability,
} from './tournament';

/**
 * Returns the unavailability entry for a part-day, if one exists.
 * @param entries persisted unavailability entries
 * @param dayId tournament day identifier
 * @param partDayId tournament part-day identifier
 */
export function findPartDayUnavailability(
  entries: PartDayUnavailability[] | undefined,
  dayId: string,
  partDayId: string,
): PartDayUnavailability | undefined {
  return entries?.find(entry => entry.dayId === dayId && entry.partDayId === partDayId);
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
 * Normalizes persisted unavailability entries against the current tournament.
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

  const partDays = new Map<string, PartDay>();
  for (const day of days) {
    for (const partDay of day.parts) {
      if (partDay.timeslots.length > 0) {
        partDays.set(partDayKey(day.id, partDay.id), partDay);
      }
    }
  }

  const merged = new Map<string, PartDayUnavailability>();
  for (const entry of entries) {
    const partDay = partDays.get(partDayKey(entry.dayId, entry.partDayId));
    if (!partDay) continue;

    const validSlotIds = new Set(partDay.timeslots.map(slot => slot.id));
    const unavailableSlotIds = unique(
      entry.unavailableSlotIds.filter(slotId => validSlotIds.has(slotId)),
    );
    const key = partDayKey(entry.dayId, entry.partDayId);
    const existing = merged.get(key);

    if (entry.unavailability === 'TOTAL' || existing?.unavailability === 'TOTAL') {
      merged.set(key, {
        dayId: entry.dayId,
        partDayId: entry.partDayId,
        unavailability: 'TOTAL',
        unavailableSlotIds: [],
      });
      continue;
    }

    const combinedSlotIds = unique([...(existing?.unavailableSlotIds ?? []), ...unavailableSlotIds]);
    if (combinedSlotIds.length === 0) continue;
    merged.set(key, {
      dayId: entry.dayId,
      partDayId: entry.partDayId,
      unavailability: combinedSlotIds.length === validSlotIds.size ? 'TOTAL' : 'PARTIAL',
      unavailableSlotIds: combinedSlotIds.length === validSlotIds.size ? [] : combinedSlotIds,
    });
  }

  return merged.size > 0 ? [...merged.values()] : undefined;
}

/**
 * Creates a normalized entry for the selected unavailable slots.
 * @param dayId tournament day identifier
 * @param partDay tournament part-day
 * @param unavailableSlotIds selected unavailable slot identifiers
 * @returns an entry, or undefined when all slots are available
 */
export function createPartDayUnavailability(
  dayId: string,
  partDay: PartDay,
  unavailableSlotIds: string[],
): PartDayUnavailability | undefined {
  const slotIds = unique(unavailableSlotIds);
  if (slotIds.length === 0) return undefined;
  const isTotal = slotIds.length === partDay.timeslots.length;
  return {
    dayId,
    partDayId: partDay.id,
    unavailability: isTotal ? 'TOTAL' : 'PARTIAL',
    unavailableSlotIds: isTotal ? [] : slotIds,
  };
}

/** Returns the stable key used to identify a part-day. */
function partDayKey(dayId: string, partDayId: string): string {
  return `${dayId}/${partDayId}`;
}

/** Removes duplicate string values while preserving their first-seen order. */
function unique(values: string[]): string[] {
  return [...new Set(values)];
}
