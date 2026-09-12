import { createTournamentRefereeRanking, prepareIndividualRanking } from '@tournament-manager/persistent-data-model';

describe('Individual persistence contract', () => {
  const parent = {
    ...createTournamentRefereeRanking('t', 'coach', 'Finals'),
    id: 'ranking',
    status: 'PANEL_RANKING' as const,
    selectedCoachAttendeeIds: ['coach'],
    selectedRefereeAttendeeIds: ['a', 'b'],
    panelResultState: 'CURRENT' as const,
  };

  it('creates lazily with dense order and preserves the ranking timestamp during lock-only changes', () => {
    const created = prepareIndividualRanking(parent, null, 'coach', { rankedRefereeAttendeeIds: ['a'] }, 1000);
    expect(created.individual.id).toBe('ranking|coach');
    expect(created.individual.locked).toBeFalse();
    expect(created.panelResultState).toBe('CURRENT');
    const locked = prepareIndividualRanking(parent, created.individual, 'coach', { locked: true }, 2000);
    expect(locked.panelResultState).toBe('STALE');
    expect(locked.individual.rankingLastChange).toBe(created.individual.rankingLastChange);
    expect(locked.individual.lastChange).toBe(2000);
    expect(() =>
      prepareIndividualRanking(parent, locked.individual, 'coach', { rankedRefereeAttendeeIds: ['b'] }),
    ).toThrow();
    const unlocked = prepareIndividualRanking(parent, locked.individual, 'coach', { locked: false }, 3000);
    expect(unlocked.panelResultState).toBe('STALE');
    expect(
      prepareIndividualRanking(parent, unlocked.individual, 'coach', { rankedRefereeAttendeeIds: [] }, 4000).individual
        .rankingLastChange,
    ).not.toBe(unlocked.individual.rankingLastChange);
  });

  it('supports empty locks, practice and never-computed votes without dirtying irrelevant results', () => {
    expect(prepareIndividualRanking(parent, null, 'practice', { locked: true }).panelResultState).toBe('CURRENT');
    expect(
      prepareIndividualRanking({ ...parent, panelResultState: 'NOT_COMPUTED' }, null, 'coach', { locked: true })
        .panelResultState,
    ).toBe('NOT_COMPUTED');
    expect(
      prepareIndividualRanking(parent, null, 'coach', { locked: true }).individual.rankedRefereeAttendeeIds,
    ).toEqual([]);
  });

  it('rejects duplicate/unselected IDs, immutable identity changes and forbidden phases', () => {
    for (const ids of [['a', 'a'], ['outside']])
      expect(() => prepareIndividualRanking(parent, null, 'coach', { rankedRefereeAttendeeIds: ids })).toThrow();
    const previous = prepareIndividualRanking(parent, null, 'coach', { locked: false }).individual;
    expect(() => prepareIndividualRanking(parent, previous, 'other', { locked: true })).toThrow();
    for (const status of ['CONFIGURE', 'CLOSED'] as const)
      expect(() => prepareIndividualRanking({ ...parent, status }, null, 'coach', { locked: true })).toThrow();
  });
});
