import { Attendee, Referee, defaultSlotType } from '@tournament-manager/persistent-data-model';
import { GameView } from '../allocation-data-model';
import {
  RefereeSelectorEntry,
  RefereeSelectorFacade,
  isRefereeEligible,
  matchesSearch,
} from './referee-selector.service';

describe('referee selector calculations', () => {
  it('keeps filter values shared between selector openings', () => {
    const facade = new RefereeSelectorFacade();

    facade.updateFilters({ level: '3', upgradeOnly: true, sortMode: 'games-asc' });

    expect(facade.filters()).toEqual({
      level: '3',
      category: 'All',
      gender: 'All',
      upgradeOnly: true,
      playerRefereesOnly: false,
      eligibilityEnabled: true,
      sortMode: 'games-asc',
    });
  });

  it('requires every search term, including special tokens', () => {
    const entry = selectorEntry({ level: 3, category: 'S', upgrade: true, search: 'laurent garrigues l3s*' });

    expect(matchesSearch(entry, 'Laurent L3S*')).toBeTrue();
    expect(matchesSearch(entry, 'Laurent L2S*')).toBeFalse();
    expect(matchesSearch(entry, 'Laurent Unknown')).toBeFalse();
  });

  it('rejects a referee unavailable on the target slot', () => {
    const entry = selectorEntry({
      unavailabilities: [{ dayId: 'day-1', unavailability: 'PARTIAL', unavailableSlotIds: ['slot-2'] }],
    });
    const target = game('game-2', slot('slot-2', 50, 100, 40));

    expect(isRefereeEligible(entry, target, [], configuration())).toBeFalse();
  });

  it('counts playing time, not break-inclusive slot duration', () => {
    const entry = selectorEntry();
    const assigned = game('game-1', slot('slot-1', 0, 50, 40), entry.referee);
    const target = game('game-2', slot('slot-2', 50, 100, 40));

    expect(isRefereeEligible(entry, target, [assigned], configuration(80, 80))).toBeTrue();
    expect(isRefereeEligible(entry, target, [assigned], configuration(79, 80))).toBeFalse();
  });

  it('rejects a referee already assigned to another game in the same timeslot', () => {
    const entry = selectorEntry();
    const assigned = game('game-1', slot('slot-1', 0, 50, 20), entry.referee);
    const target = game('game-2', slot('slot-1', 0, 50, 20));

    expect(isRefereeEligible(entry, target, [assigned], configuration())).toBeFalse();
  });

  it('rejects a referee already assigned to the target game', () => {
    const entry = selectorEntry();
    const target = game('game-2', slot('slot-2', 50, 100, 20), entry.referee);

    expect(isRefereeEligible(entry, target, [], configuration())).toBeFalse();
  });
});

function selectorEntry(options: {
  level?: number;
  category?: string;
  upgrade?: boolean;
  search?: string;
  unavailabilities?: unknown[];
} = {}): RefereeSelectorEntry {
  const attendee = {
    id: 'referee-1',
    referee: {
      badge: options.level ?? 1,
      badgeSystem: 5,
      category: options.category ?? 'S',
      upgrade: options.upgrade ? { badge: 2, badgeSystem: 5 } : undefined,
    },
    unavailabilities: options.unavailabilities,
  } as Attendee;
  const referee = {
    attendee,
    isPR: false,
    person: { firstName: 'Laurent', lastName: 'Garrigues', shortName: 'LG', search: options.search ?? 'laurent garrigues l1s' },
  } as Referee;
  return {
    referee,
    searchText: options.search ?? 'laurent garrigues l1s',
    displayName: 'Laurent Garrigues',
    level: options.level ?? 1,
    category: options.category ?? 'S',
    upgrade: options.upgrade ?? false,
    isPlayerReferee: false,
    games: [],
  };
}

function game(id: string, timeslot: ReturnType<typeof slot>, referee?: Referee): GameView {
  return {
    game: { id, dayId: 'day-1', timeslotId: timeslot.id } as GameView['game'],
    timeslot,
    timeslotStr: '10:00',
    referees: referee ? [{ attendeeAlloc: { attendeeId: referee.attendee.id } as GameView['referees'][number]['attendeeAlloc'], referee }] : [],
    coaches: [],
  };
}

function slot(id: string, start: number, end: number, playTime: number) {
  return {
    id,
    start,
    end,
    duration: end - start,
    playingSlot: true,
    slotType: { ...defaultSlotType, playTime },
  };
}

function configuration(maxInRow: number = 50, maxPerDay: number = 140) {
  return {
    maxGameInRowForReferee: maxInRow,
    maxGameInRowForRefereeCoach: 160,
    allocateRefereeCoach: false,
    refereeCoachTwoField: false,
    nbRefereePerGame: 3,
    maxRefereeGameTimePerDay: maxPerDay,
  };
}
