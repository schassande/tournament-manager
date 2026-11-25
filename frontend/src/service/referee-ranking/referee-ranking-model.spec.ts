import {
  coachRefereesRankingId,
  createTournamentRefereeRanking,
  rankingFromStorage,
  rankingToStorage,
  refereeRankingTransitions,
} from '@tournament-manager/persistent-data-model';

describe('referee ranking contracts', () => {
  it('creates a trimmed empty configuration with a target of 15 and no computed result', () => {
    const ranking = createTournamentRefereeRanking('tournament', 'coach', '  Finals  ');
    expect(ranking.name).toBe('Finals');
    expect(ranking.nbRefereesToRank).toBe(15);
    expect(ranking.voteMajority).toBe(1);
    expect(ranking.panelResultState).toBe('NOT_COMPUTED');
    expect(ranking.panelRefereesRanking.rankingLastChange).toBe('');
    expect(() => createTournamentRefereeRanking('tournament', 'coach', '   ')).toThrow();
  });

  it('round-trips Firestore-compatible statistics without shared mutable rows', () => {
    const ranking = createTournamentRefereeRanking('tournament', 'coach', 'Finals');
    ranking.panelRefereesRanking = {
      rankingLastChange: '2026-09-12T12:00:00.000Z',
      rankedRefereeAttendeeIds: ['a', 'b'],
      stats: [
        [1, 2],
        [2, 3, 3],
      ],
    };
    const stored = rankingToStorage(ranking);
    expect(stored.panelRefereesRanking.stats).toEqual([{ ranks: [1, 2] }, { ranks: [2, 3, 3] }]);
    const restored = rankingFromStorage(stored);
    expect(restored).toEqual(ranking);
    restored.panelRefereesRanking.stats[0].push(8);
    expect(stored.panelRefereesRanking.stats[0].ranks).toEqual([1, 2]);
    expect(ranking.panelRefereesRanking.stats[0]).toEqual([1, 2]);
  });

  it('rejects mismatched statistics instead of attributing votes to the wrong referee', () => {
    const ranking = createTournamentRefereeRanking('tournament', 'coach', 'Finals');
    ranking.panelRefereesRanking.rankedRefereeAttendeeIds = ['a'];
    expect(() => rankingToStorage(ranking)).toThrowError(/matching lengths/);
  });

  it('never permits closure for an uncomputed or stale result but permits a computed empty result', () => {
    const ranking = createTournamentRefereeRanking('tournament', 'coach', 'Finals');
    ranking.status = 'PANEL_RANKING';
    expect(refereeRankingTransitions(ranking)).toEqual(['INDIVIDUAL_RANKING']);
    ranking.panelResultState = 'CURRENT';
    expect(refereeRankingTransitions(ranking)).not.toContain('CLOSED');
    ranking.panelRefereesRanking.rankingLastChange = '2026-09-12T12:00:00.000Z';
    expect(refereeRankingTransitions(ranking)).toContain('CLOSED');
    ranking.panelResultState = 'STALE';
    expect(refereeRankingTransitions(ranking)).not.toContain('CLOSED');
    ranking.status = 'CLOSED';
    expect(refereeRankingTransitions(ranking)).toEqual([]);
  });

  it('does not collide when either identity component contains a separator or slash', () => {
    expect(coachRefereesRankingId('é%|ranking', 'é%|coach')).toBe('é%25%7Cranking|é%25%7Ccoach');
    expect(coachRefereesRankingId('a%7C', 'b')).not.toBe(coachRefereesRankingId('a|', 'b'));
    expect(coachRefereesRankingId('a|b', 'c')).not.toBe(coachRefereesRankingId('a', 'b|c'));
    expect(coachRefereesRankingId('a/b', 'c')).not.toContain('/');
    expect(coachRefereesRankingId('a', 'b')).toBe(coachRefereesRankingId('a', 'b'));
  });
});
