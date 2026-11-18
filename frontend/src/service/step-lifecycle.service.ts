import { DrawGame, Game, Step, StepStatus } from '@tournament-manager/persistent-data-model';

/** Maps the legacy persisted status to the current lifecycle vocabulary. */
export function normalizeStepStatus(status: Step['status'] | 'DRAWED'): StepStatus {
  return status === 'DRAWED' ? 'DRAWN' : status;
}

/** Computes a step status from its draw games and their allocated real games. */
export function computeStepStatus(step: Step, games: Game[]): StepStatus {
  const currentStatus = normalizeStepStatus(step.status);
  if (currentStatus === 'CANCELED') return 'CANCELED';

  const drawGames = step.groups.flatMap((group) => group.games);
  if (!drawGames.length) return 'DRAFT';
  if (drawGames.every((drawGame) => drawGame.status === 'FINISHED')) return 'FINISHED';
  if (drawGames.some((drawGame) => drawGame.status === 'PLAYING' || drawGame.status === 'FINISHED')) return 'RUNNING';

  const gamesById = new Map(games.map((game) => [game.id, game]));
  const allocatedCount = drawGames.filter((drawGame) => isDrawGameAllocated(drawGame, gamesById)).length;
  if (allocatedCount === drawGames.length) return 'PLANIFIED';
  if (allocatedCount > 0) return 'PLANIFYING';
  return 'DRAWN';
}

/** Returns whether a draw game points to a real game with a complete schedule allocation. */
export function isDrawGameAllocated(drawGame: DrawGame, gamesById: Map<string, Game>): boolean {
  if (!drawGame.gameId) return false;
  const game = gamesById.get(drawGame.gameId);
  return Boolean(game?.dayId && game.timeslotId && game.fieldId);
}
