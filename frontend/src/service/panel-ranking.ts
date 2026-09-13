import {
  Attendee,
  CoachRefereesRanking,
  PanelRefereesRanking,
  TournamentRefereeRanking,
} from '@tournament-manager/persistent-data-model';

/** Compares nomination histories lexicographically, preferring longer exact prefixes. */
export function compareNominations(a: readonly number[], b: readonly number[]): number {
  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return b.length - a.length;
}

/** Computes complete round-based admissions from locked panel votes, freezing statistics at admission. */
export function computePanelRanking(
  ranking: TournamentRefereeRanking,
  individuals: readonly CoachRefereesRanking[],
  attendees: ReadonlyMap<string, Attendee>,
  now = Date.now(),
): PanelRefereesRanking {
  if (!Number.isSafeInteger(ranking.voteMajority) || ranking.voteMajority < 1)
    throw new Error('A positive safe integer majority is required.');
  const votes = individuals.filter(
    (vote) =>
      vote.locked &&
      vote.tournamentId === ranking.tournamentId &&
      vote.tournamentRefereeRankingId === ranking.id &&
      ranking.selectedCoachAttendeeIds.includes(vote.coachAttendeeId),
  );
  const eligible = new Set(ranking.selectedRefereeAttendeeIds);
  const nominations = new Map<string, number[]>();
  const admitted = new Set<string>();
  const result: PanelRefereesRanking = {
    rankedRefereeAttendeeIds: [],
    stats: [],
    rankingLastChange: new Date(now).toISOString(),
  };
  const rounds = Math.max(0, ...votes.map((vote) => vote.rankedRefereeAttendeeIds.length));
  for (let round = 0; round < rounds; round++) {
    // Collect every nomination in the round before comparing newly qualified referees.
    for (const vote of votes) {
      const id = vote.rankedRefereeAttendeeIds[round];
      if (!eligible.has(id)) continue;
      const ranks = nominations.get(id) ?? [];
      ranks.push(round + 1);
      nominations.set(id, ranks);
    }
    const additions = [...nominations.keys()].filter(
      (id) => !admitted.has(id) && nominations.get(id)!.length >= ranking.voteMajority,
    );
    additions.sort(
      (a, b) => compareNominations(nominations.get(a)!, nominations.get(b)!) || compareRefereeNames(a, b, attendees),
    );
    for (const id of additions) {
      admitted.add(id);
      result.rankedRefereeAttendeeIds.push(id);
      result.stats.push([...nominations.get(id)!]);
    }
  }
  return result;
}

/** Resolves exact nomination ties by first name, last name and stable attendee ID. */
function compareRefereeNames(a: string, b: string, attendees: ReadonlyMap<string, Attendee>): number {
  const left = attendees.get(a)?.person;
  const right = attendees.get(b)?.person;
  return (
    (left?.firstName ?? '').localeCompare(right?.firstName ?? '') ||
    (left?.lastName ?? '').localeCompare(right?.lastName ?? '') ||
    a.localeCompare(b)
  );
}
