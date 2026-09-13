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
    const created = prepareIndividualRanking(parent, null, 'coach', 'coach', { rankedRefereeAttendeeIds: ['a'] }, 1000);
    expect(created.individual.id).toBe('ranking|coach');
    expect(created.individual.locked).toBeFalse();
    expect(created.panelResultState).toBe('CURRENT');
    const locked = prepareIndividualRanking(parent, created.individual, 'coach', 'coach', { locked: true }, 2000);
    expect(locked.panelResultState).toBe('STALE');
    expect(locked.individual.rankingLastChange).toBe(created.individual.rankingLastChange);
    expect(locked.individual.lastChange).toBe(2000);
    expect(() =>
      prepareIndividualRanking(parent, locked.individual, 'coach', 'coach', { rankedRefereeAttendeeIds: ['b'] }),
    ).toThrow();
    const unlocked = prepareIndividualRanking(parent, locked.individual, 'coach', 'coach', { locked: false }, 3000);
    expect(unlocked.panelResultState).toBe('STALE');
    expect(
      prepareIndividualRanking(parent, unlocked.individual, 'coach', 'coach', { rankedRefereeAttendeeIds: [] }, 4000)
        .individual.rankingLastChange,
    ).not.toBe(unlocked.individual.rankingLastChange);
  });

  it('supports empty locks, practice and never-computed votes without dirtying irrelevant results', () => {
    expect(prepareIndividualRanking(parent, null, 'practice', 'practice', { locked: true }).panelResultState).toBe(
      'CURRENT',
    );
    expect(
      prepareIndividualRanking({ ...parent, panelResultState: 'NOT_COMPUTED' }, null, 'coach', 'coach', {
        locked: true,
      }).panelResultState,
    ).toBe('NOT_COMPUTED');
    expect(
      prepareIndividualRanking(parent, null, 'coach', 'coach', { locked: true }).individual.rankedRefereeAttendeeIds,
    ).toEqual([]);
  });

  it('rejects duplicate/unselected IDs, immutable identity changes and forbidden phases', () => {
    for (const ids of [['a', 'a'], ['outside']])
      expect(() =>
        prepareIndividualRanking(parent, null, 'coach', 'coach', { rankedRefereeAttendeeIds: ids }),
      ).toThrow();
    const previous = prepareIndividualRanking(parent, null, 'coach', 'coach', { locked: false }).individual;
    expect(() => prepareIndividualRanking(parent, previous, 'other', 'other', { locked: true })).toThrow();
    for (const status of ['CONFIGURE', 'CLOSED'] as const)
      expect(() => prepareIndividualRanking({ ...parent, status }, null, 'coach', 'coach', { locked: true })).toThrow();
  });

  it('keeps target ownership and records each editor while upgrading a legacy vote without changing its ranking time', () => {
    const selected = { ...parent, selectedCoachAttendeeIds: ['coach', 'target'] };
    const created = prepareIndividualRanking(
      selected,
      null,
      'coach',
      'target',
      { rankedRefereeAttendeeIds: ['a'] },
      1000,
    );
    expect(created.individual.id).toBe('ranking|target');
    expect(created.individual.coachAttendeeId).toBe('target');
    expect(created.individual.updatedByCoachAttendeeId).toBe('coach');
    const { updatedByCoachAttendeeId, ...legacy } = created.individual;
    const locked = prepareIndividualRanking(selected, legacy, 'target', 'target', { locked: true }, 2000);
    expect(locked.individual.updatedByCoachAttendeeId).toBe('target');
    expect(locked.individual.rankingLastChange).toBe(legacy.rankingLastChange);
    expect(locked.panelResultState).toBe('STALE');
    expect(legacy).not.toEqual(jasmine.objectContaining({ updatedByCoachAttendeeId: jasmine.anything() }));
  });

  it('requires selected membership on both sides of delegation, but allows own practice', () => {
    for (const [actor, target] of [
      ['coach', 'practice'],
      ['practice', 'coach'],
      ['practice', 'other'],
    ]) {
      expect(() => prepareIndividualRanking(parent, null, actor, target, { locked: true })).toThrow();
    }
    const own = prepareIndividualRanking(parent, null, 'practice', 'practice', { locked: true });
    expect(own.panelResultState).toBe('CURRENT');
    expect(own.individual.updatedByCoachAttendeeId).toBe('practice');
    expect(() => prepareIndividualRanking(parent, null, '', 'coach', { locked: true })).toThrow();
  });
});
