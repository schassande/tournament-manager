import {
  Attendee,
  CoachRefereesRanking,
  createTournamentRefereeRanking,
} from '@tournament-manager/persistent-data-model';
import { compareNominations, computePanelRanking } from './panel-ranking';

/** Independent input/expected-output contract from the ten specification datasets. */
interface Dataset {
  votes: string[];
  majority: number;
  ids: string;
  stats: number[][];
}

describe('panel ranking algorithm', () => {
  const cases: Dataset[] = [
    {
      votes: ['AB', 'AB', 'AB'],
      majority: 2,
      ids: 'AB',
      stats: [
        [1, 1, 1],
        [2, 2, 2],
      ],
    },
    { votes: ['AB', 'BA'], majority: 1, ids: 'AB', stats: [[1], [1]] },
    {
      votes: ['ABC', 'BAC', 'ACB'],
      majority: 3,
      ids: 'ABC',
      stats: [
        [1, 1, 2],
        [1, 2, 3],
        [2, 3, 3],
      ],
    },
    {
      votes: ['AB', 'BA', 'XBA', 'YBA'],
      majority: 2,
      ids: 'BA',
      stats: [
        [1, 2, 2, 2],
        [1, 2],
      ],
    },
    {
      votes: ['AXYZWB', 'BXYZWA', 'XYAZWB', 'XYZBWA', 'XYZWAB', 'XYZWBA'],
      majority: 3,
      ids: 'XYZABW',
      stats: [
        [1, 1, 1, 1],
        [2, 2, 2, 2],
        [3, 3, 3],
        [1, 3, 5],
        [1, 4, 5],
        [4, 4, 5, 5, 5, 5],
      ],
    },
    { votes: ['ABC', 'BCA', 'CAB'], majority: 1, ids: 'BAC', stats: [[1], [1], [1]] },
    {
      votes: ['AB', 'AB', 'AB', 'AB'],
      majority: 3,
      ids: 'AB',
      stats: [
        [1, 1, 1, 1],
        [2, 2, 2, 2],
      ],
    },
    { votes: ['A', 'BA', '', 'B', 'AB'], majority: 2, ids: '', stats: [] },
    {
      votes: ['AB', 'AB', 'BA'],
      majority: 2,
      ids: 'AB',
      stats: [
        [1, 1],
        [1, 2, 2],
      ],
    },
    {
      votes: ['ABC', 'ABD'],
      majority: 2,
      ids: 'AB',
      stats: [
        [1, 1],
        [2, 2],
      ],
    },
  ];
  cases.forEach((dataset, index) => {
    it(`matches specification dataset ${index + 1} with frozen statistics`, () => {
      const ranking = {
        ...createTournamentRefereeRanking('t', 'actor', 'Finals'),
        id: 'r',
        selectedRefereeAttendeeIds: [...'ABCDXYZW'],
        selectedCoachAttendeeIds: dataset.votes.map((_, i) => `${i}`),
        voteMajority: dataset.majority,
        nbRefereesToRank: index === 9 ? 1 : 15,
      };
      let votes = dataset.votes.map(
        (order, i) =>
          ({
            coachAttendeeId: `${i}`,
            tournamentId: 't',
            tournamentRefereeRankingId: 'r',
            rankedRefereeAttendeeIds: [...order],
            locked: true,
          }) as CoachRefereesRanking,
      );
      const attendees = new Map(
        [...'ABCDXYZW'].map((id) => [id, { id, person: { firstName: id, lastName: id } } as Attendee]),
      );
      if (index === 5) {
        for (const [id, firstName, lastName] of [
          ['A', 'Alex', 'Zulu'],
          ['B', 'Alex', 'Alpha'],
          ['C', 'Zoe', 'Alpha'],
        ])
          attendees.set(id, { id, person: { firstName, lastName } } as Attendee);
      }
      if (index === 7) {
        votes[1].locked = false;
        votes = votes.filter((vote) => vote.coachAttendeeId !== '2');
        ranking.selectedCoachAttendeeIds = ['0', '1', '2', '3'];
      }
      const original = structuredClone(votes);
      const result = computePanelRanking(ranking, votes, attendees, 0);
      expect(result.rankedRefereeAttendeeIds).toEqual([...dataset.ids]);
      expect(result.stats).toEqual(dataset.stats);
      expect(result.rankingLastChange).toBe('1970-01-01T00:00:00.000Z');
      expect(votes).toEqual(original);
    });
  });

  it('compares first differing ranks before counts and favors longer exact prefixes', () => {
    expect(compareNominations([1, 3, 5], [1, 4, 5])).toBeLessThan(0);
    expect(compareNominations([1, 3, 5, 5], [1, 3, 5])).toBeLessThan(0);
    expect(compareNominations([1, 2], [2, 2, 2, 2])).toBeLessThan(0);
    expect(compareNominations([1], [1])).toBe(0);
  });

  it('uses stable IDs for identical names and records a computed empty result without votes', () => {
    const ranking = {
      ...createTournamentRefereeRanking('t', 'actor', 'Finals'),
      id: 'r',
      selectedRefereeAttendeeIds: ['B', 'A'],
      selectedCoachAttendeeIds: ['1', '2'],
    };
    const votes = ['B', 'A'].map(
      (id, i) =>
        ({
          coachAttendeeId: `${i + 1}`,
          tournamentId: 't',
          tournamentRefereeRankingId: 'r',
          rankedRefereeAttendeeIds: [id],
          locked: true,
        }) as CoachRefereesRanking,
    );
    const names = new Map(
      ['A', 'B'].map((id) => [id, { id, person: { firstName: 'Alex', lastName: 'Same' } } as Attendee]),
    );
    expect(computePanelRanking(ranking, votes, names).rankedRefereeAttendeeIds).toEqual(['A', 'B']);
    expect(computePanelRanking(ranking, [], names).stats).toEqual([]);
    expect(computePanelRanking(ranking, [], names).rankingLastChange).not.toBe('');
  });
});
