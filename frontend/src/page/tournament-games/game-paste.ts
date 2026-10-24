import { Division, Field, Game, Timeslot } from '@tournament-manager/persistent-data-model';

/** Existing tournament references available to a paste into the selected day. */
export interface GamePasteContext {
  tournamentId: string;
  dayId: string;
  slots: (Timeslot & { startStr: string; availableFieldIds?: string[] })[];
  fields: Field[];
  divisions: Division[];
}

/** Validated games and line-specific errors; callers must reject all games when errors exist. */
export interface GamePasteResult {
  games: Game[];
  errors: string[];
}

/** Resolves an unambiguous identifier, name, or short name without creating reference data. */
function resolveReference<T extends { id: string; name?: string; shortName?: string }>(
  items: T[],
  value: string,
  label: string,
): T {
  if (!value) throw new Error(`${label}: unknown or ambiguous value "${value}".`);
  const normalized = value.toLocaleLowerCase().trim();
  const matches = items.filter((item) =>
    [item.id, item.name, item.shortName].some((candidate) => candidate?.toLocaleLowerCase().trim() === normalized),
  );
  if (matches.length === 0)
    throw new Error(
      `${label}: value not recognized "${value}" among ${items.map((m) => m.name + '/' + m.shortName).join(',')}`,
    );
  if (matches.length > 1)
    throw new Error(
      `${label}: Several item found for "${value}", ${matches.map((m) => m.name + '/' + m.shortName).join(',')}`,
    );
  return matches[0];
}

/** Detects a slot/field collision, optionally excluding the game currently being edited. */
export function hasGameConflict(games: Game[], slotId: string, fieldId: string, excludedId?: string): boolean {
  return games.some(
    (game) => game.timeslotId === slotId && game.fieldId === fieldId && (!excludedId || game.id !== excludedId),
  );
}

/** Parses up to seven spreadsheet columns, including the optional result-required flag. */
export function parseGamePaste(text: string, context: GamePasteContext, existing: Game[]): GamePasteResult {
  const result: GamePasteResult = { games: [], errors: [] };
  // Keep original line numbers in diagnostics, including blank and header rows.
  text.split(/\r\n|\n|\r/).forEach((line, index) => {
    if (!line.trim()) return;
    const cells = line.split('\t').map((cell) => cell.trim());
    const isHeader =
      /^(slot|time slot)$/i.test(cells[0]) &&
      /^field$/i.test(cells[1]) &&
      (cells.length === 2 || /^division$/i.test(cells[2]));
    if (index === 0 && isHeader) return;
    try {
      const game = parseGameRow(cells, context);
      if (hasGameConflict(result.games, game.timeslotId, game.fieldId)) {
        throw new Error(`Slot "${cells[0]}" / field "${cells[1]}" is already occupied.`);
      }
      result.games.push(replaceExistingGame(game, existing, context));
    } catch (error) {
      result.errors.push(`Line ${index + 1}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  if (!result.games.length && !result.errors.length) result.errors.push('No game rows to paste.');
  return result;
}

/** Replaces imported fields while preserving the persisted identity and unrelated game metadata. */
function replaceExistingGame(game: Game, existing: Game[], context: GamePasteContext): Game {
  const matches = existing.filter(
    (item) =>
      item.tournamentId === context.tournamentId &&
      item.dayId === context.dayId &&
      item.timeslotId === game.timeslotId &&
      item.fieldId === game.fieldId,
  );
  if (matches.length > 1) throw new Error('Several existing games occupy this slot / field; replacement is ambiguous.');
  if (!matches.length) return game;
  const previous = matches[0];
  const replacement = { ...previous, ...game, id: previous.id, scheduleId: previous.scheduleId };
  // An empty optional clipboard value clears the old flag instead of retaining stale data.
  if (game.resultRequired === undefined) delete replacement.resultRequired;
  return replacement;
}

/** Converts one row using required slot/field and optional trailing columns. */
function parseGameRow(cells: string[], context: GamePasteContext): Game {
  if (cells.length < 2 || cells.length > 7) throw new Error('Expected 2 to 7 tab-separated columns.');
  const [slotValue, fieldValue, divisionValue = '', what = '', resultValue = '', homeValue = '', awayValue = ''] =
    cells;
  const resultRequired = parseResultRequired(resultValue);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(slotValue)) throw new Error('Slot must use HH:MM format.');
  const slots = context.slots.filter((slot) => slot.playingSlot && slot.startStr === slotValue);
  if (slots.length !== 1) throw new Error(`Slot: unknown or ambiguous time "${slotValue}" in the selected day.`);
  const slot = slots[0];
  const field = resolveReference(context.fields, fieldValue, 'Field');
  if (slot.availableFieldIds && !slot.availableFieldIds.includes(field.id)) {
    throw new Error(`Field "${fieldValue}" is unavailable at ${slotValue}.`);
  }
  const division =
    !divisionValue && context.divisions.length === 1
      ? context.divisions[0]
      : resolveReference(context.divisions, divisionValue, 'Division');
  // Teams are resolved within the selected division to avoid cross-division matches.
  const home = homeValue
    ? resolveReference(division.teams, homeValue, 'Team 1 of division ' + division.name + '/' + division.shortName)
    : undefined;
  const away = awayValue
    ? resolveReference(division.teams, awayValue, 'Team 2 of division ' + division.name + '/' + division.shortName)
    : undefined;
  return {
    id: '',
    lastChange: Date.now(),
    tournamentId: context.tournamentId,
    dayId: context.dayId,
    scheduleId: '',
    timeslotId: slot.id,
    fieldId: field.id,
    divisionId: division.id,
    what,
    ...(resultRequired === undefined ? {} : { resultRequired }),
    homeTeamId: home?.id ?? '',
    awayTeamId: away?.id ?? '',
  };
}

/** Parses an optional boolean without silently treating invalid values as false. */
function parseResultRequired(value: string): boolean | undefined {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (['yes', 'oui', 'true', '1'].includes(normalized)) return true;
  if (['no', 'non', 'false', '0'].includes(normalized)) return false;
  throw new Error(`Result Required?: unrecognized value "${value}". Use Yes/No, Oui/Non, true/false or 1/0.`);
}
