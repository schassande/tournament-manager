import { DrawGame, Game, TeamReference, Tournament } from '@tournament-manager/persistent-data-model';

/** A draw game enriched with the identifiers needed by the planning screen. */
export interface PlanningDrawGame {
  drawId: string;
  divisionId: string;
  stepId: string;
  stepName: string;
  groupId: string;
  groupName: string;
  drawGame: DrawGame;
}

/** Returns the known team identifier represented by a draw reference. */
export function knownTeamId(reference: TeamReference | undefined): string | undefined {
  return reference?.teamId;
}

/** Returns whether placing a match at a timeslot would make a team play twice. */
export function hasTeamConflict(candidate: Game, games: Game[], excludedGameIds: string[] = []): boolean {
  const excluded = new Set(excludedGameIds);
  const candidateTeams = [candidate.homeTeamId, candidate.awayTeamId].filter((teamId): teamId is string =>
    Boolean(teamId),
  );
  if (!candidateTeams.length) return false;
  return games.some((game) => {
    if (excluded.has(game.id) || game.id === candidate.id) return false;
    if (game.dayId !== candidate.dayId || game.timeslotId !== candidate.timeslotId) return false;
    return [game.homeTeamId, game.awayTeamId].some((teamId) => teamId && candidateTeams.includes(teamId));
  });
}

/** Returns the fields available on a tournament day, preserving tournament order. */
export function fieldsForDay(tournament: Tournament, dayId: string) {
  const day = tournament.days.find((item) => item.id === dayId);
  if (!day) return [];
  const allFields = day.parts.some((part) => part.allFieldsAvaillable);
  if (allFields) return [...tournament.fields].sort((left, right) => left.orderView - right.orderView);
  const ids = new Set(day.parts.flatMap((part) => part.availableFieldIds));
  return tournament.fields.filter((field) => ids.has(field.id)).sort((left, right) => left.orderView - right.orderView);
}
