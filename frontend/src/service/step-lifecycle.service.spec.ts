import { DrawGame, Game, Step } from '@tournament-manager/persistent-data-model';
import { computeStepStatus, normalizeStepStatus } from './step-lifecycle.service';

function drawGame(status: DrawGame['status'], gameId?: string): DrawGame {
  return {
    id: crypto.randomUUID(),
    round: 1,
    status,
    what: 'Match',
    resultRequired: true,
    ...(gameId ? { gameId } : {}),
    homeTeam: { teamSelectorType: 'MANUAL' },
    awayTeam: { teamSelectorType: 'MANUAL' },
  };
}

function step(games: DrawGame[], status: Step['status'] = 'DRAWN'): Step {
  return {
    id: 'step-1',
    status,
    position: 0,
    name: 'Step 1',
    drawType: {
      nbTeam: 2,
      drawName: 'Test',
      nbGroup: 1,
      nbGames: games.length,
      requirePointCalculationConfig: false,
      groups: [{ position: 0, nbTeams: 2, groupType: 'CUP2_RK2', nbGames: games.length }],
    },
    spreadTeamsAlgo: 'Random',
    inputTeamIds: [],
    groups: [{ id: 'group-1', position: 0, type: 'CUP2_RK2', name: 'A', games, teams: [], specificData: {} }],
    outputTeamIds: [],
  };
}

function game(id: string): Game {
  return {
    id,
    lastChange: 1,
    tournamentId: 'tournament-1',
    scheduleId: 'schedule-1',
    divisionId: 'division-1',
    dayId: 'day-1',
    timeslotId: 'slot-1',
    fieldId: 'field-1',
    what: 'Match',
  };
}

describe('step lifecycle', () => {
  it('normalizes the legacy DRAWED status', () => {
    expect(normalizeStepStatus('DRAWED')).toBe('DRAWN');
  });

  it('computes drawn, planning, and planified states from allocations', () => {
    const first = drawGame('DRAWN');
    const second = drawGame('DRAWN', 'game-2');
    expect(computeStepStatus(step([first, second]), [game('game-2')])).toBe('PLANIFYING');
    expect(computeStepStatus(step([first, second], 'PLANIFYING'), [game('game-2')])).toBe('PLANIFYING');
    expect(
      computeStepStatus(step([drawGame('PLANIFIED', 'game-1'), second], 'PLANIFYING'), [
        game('game-1'),
        game('game-2'),
      ]),
    ).toBe('PLANIFIED');
  });

  it('uses playing and finished draw-game statuses for running and finished', () => {
    expect(computeStepStatus(step([drawGame('PLAYING')], 'PLANIFIED'), [])).toBe('RUNNING');
    expect(computeStepStatus(step([drawGame('FINISHED')], 'RUNNING'), [])).toBe('FINISHED');
  });

  it('preserves cancellation', () => {
    expect(computeStepStatus(step([drawGame('DRAWN')], 'CANCELED'), [])).toBe('CANCELED');
  });
});
