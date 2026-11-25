import { DrawGame, Group, GroupType, TeamReference } from '@tournament-manager/persistent-data-model';

import { allocateGroupGamesCup } from './draw-cup.service';

describe('allocateGroupGamesCup', () => {
  it('allocates a final for CUP2_RK2', () => {
    const group = testGroup('CUP2_RK2', 2);

    allocateGroupGamesCup(group, 'CUP2_RK2', 'Division-Step');

    expect(group.games.length).toBe(1);
    expect(group.games[0]).toEqual(
      jasmine.objectContaining({
        awayTeam: { teamSelectorType: 'RANK', rank: 2 },
        homeTeam: { teamSelectorType: 'RANK', rank: 1 },
        resultRequired: true,
        round: 1,
        status: 'DRAWN',
        what: 'Division-Step-Final',
      }),
    );
    expect(group.games[0].id).toBeTruthy();
  });

  it('allocates the semi-finals and final for CUP4_RK2', () => {
    const group = testGroup('CUP4_RK2', 4);

    allocateGroupGamesCup(group, 'CUP4_RK2', 'Division-Step');

    expect(group.games.length).toBe(3);
    expect(group.games.slice(0, 2)).toEqual([
      jasmine.objectContaining({
        awayTeam: { teamSelectorType: 'RANK', rank: 2 },
        homeTeam: { teamSelectorType: 'RANK', rank: 1 },
        resultRequired: true,
        round: 1,
        status: 'DRAWN',
        what: 'Division-Step-Semi-Final',
      }),
      jasmine.objectContaining({
        awayTeam: { teamSelectorType: 'RANK', rank: 4 },
        homeTeam: { teamSelectorType: 'RANK', rank: 3 },
        resultRequired: true,
        round: 1,
        status: 'DRAWN',
        what: 'Division-Step-Semi-Final',
      }),
    ]);
    expect(group.games[2]).toEqual(
      jasmine.objectContaining({
        awayTeam: {
          teamSelectorType: 'WINNER_OF',
          drawGameId: group.games[1].id,
        },
        homeTeam: {
          teamSelectorType: 'WINNER_OF',
          drawGameId: group.games[0].id,
        },
        resultRequired: true,
        round: 2,
        status: 'DRAWN',
        what: 'Division-Step-Final',
      }),
    );
  });

  it('allocates the full ranking for CUP4_RK4', () => {
    expectCupGames('CUP4_RK4', 4, [2, 2]);
  });

  it('allocates the cup and final for CUP8_RK2', () => {
    expectCupGames('CUP8_RK2', 8, [4, 2, 1]);
  });

  it('allocates the cup and ranking for CUP8_RK4', () => {
    expectCupGames('CUP8_RK4', 8, [4, 2, 2]);
  });

  it('allocates the full ranking for CUP8_RK8', () => {
    expectCupGames('CUP8_RK8', 8, [4, 4, 4]);
  });
});

function expectCupGames(type: GroupType, teamCount: number, expectedGamesByRound: number[]): void {
  const group = testGroup(type, teamCount);

  allocateGroupGamesCup(group, type, 'Division-Step');

  expect(group.games.length).toBe(expectedGamesByRound.reduce((total, count) => total + count, 0));
  expectGamesByRound(group.games, expectedGamesByRound);
  expectGameTeamReferences(group);
  expect(group.games.every((game) => game.resultRequired)).toBeTrue();
  expect(group.games.every((game) => game.status === 'DRAWN')).toBeTrue();
  expect(new Set(group.games.map((game) => game.id)).size).toBe(group.games.length);
}

function expectGamesByRound(games: DrawGame[], expectedGamesByRound: number[]): void {
  const actualGamesByRound = new Map<number, number>();
  games.forEach((game) => actualGamesByRound.set(game.round, (actualGamesByRound.get(game.round) ?? 0) + 1));

  expect([...actualGamesByRound.entries()]).toEqual(expectedGamesByRound.map((count, index) => [index + 1, count]));
}

function expectGameTeamReferences(group: Group): void {
  const gamesById = new Map(group.games.map((game) => [game.id, game]));

  group.games.forEach((game) => {
    expectTeamReference(group, gamesById, game, game.homeTeam);
    expectTeamReference(group, gamesById, game, game.awayTeam);
  });
}

function expectTeamReference(
  group: Group,
  gamesById: Map<string, DrawGame>,
  game: DrawGame,
  reference: TeamReference,
): void {
  if (game.round === 1) {
    expect(reference.teamSelectorType).toBe('RANK');
    expect(group.teams.some((team) => team.rank === reference.rank)).toBeTrue();
    return;
  }

  expect(['WINNER_OF', 'LOSER_OF']).toContain(reference.teamSelectorType);
  const previousGame = reference.drawGameId ? gamesById.get(reference.drawGameId) : undefined;
  expect(previousGame?.round).toBe(game.round - 1);
}

function testGroup(type: GroupType, teamCount: number): Group {
  return {
    id: 'group-1',
    position: 0,
    type,
    name: 'Cup',
    games: [],
    teams: Array.from({ length: teamCount }, (_, index) => ({
      teamId: `team-${index + 1}`,
      rank: index + 1,
    })),
    specificData: {},
  };
}
