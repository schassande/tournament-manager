import { GameView } from '../allocation-data-model';
import { FragmentRefereeAllocationService } from './fragment-referee-allocation.service';

describe('fragment referee allocation counter', () => {
  it('counts each game once when the referee threshold is reached', () => {
    const games = [testGame('complete', 3), testGame('incomplete', 2), testGame('also-complete', 4)];

    expect(FragmentRefereeAllocationService.countAllocatedGames(games, 3)).toBe(2);
  });

  it('does not count coach allocations as referees', () => {
    const game = testGame('game-1', 3);
    game.coaches = [{ attendeeAlloc: {} as GameView['coaches'][number]['attendeeAlloc'] }];

    expect(FragmentRefereeAllocationService.countAllocatedGames([game], 3)).toBe(1);
  });
});

function testGame(id: string, refereeCount: number): GameView {
  return {
    game: { id } as GameView['game'],
    timeslotStr: '',
    referees: Array.from({ length: refereeCount }, () => ({
      attendeeAlloc: {} as GameView['referees'][number]['attendeeAlloc'],
    })),
    coaches: [],
  };
}
