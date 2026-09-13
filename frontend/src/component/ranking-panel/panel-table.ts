import { Attendee, CoachRefereesRanking, TournamentRefereeRanking } from '@tournament-manager/persistent-data-model';
import { rankingRefereeLabel } from '../ranking-me/ranking-me-state';

/** Shared visible/exported table, with dense rows and identical column ordering. */
export interface PanelTable {
  headers: string[];
  rows: (string | number)[][];
}

/** Builds the panel and practice comparison without additional reads or persistence. */
export function buildPanelTable(
  ranking: TournamentRefereeRanking,
  individuals: readonly CoachRefereesRanking[],
  attendees: ReadonlyMap<string, Attendee>,
): PanelTable {
  // Membership alone determines the groups; unlocked and empty practice records remain visible.
  const votes = [...individuals].sort(
    (a, b) =>
      Number(ranking.selectedCoachAttendeeIds.includes(b.coachAttendeeId)) -
        Number(ranking.selectedCoachAttendeeIds.includes(a.coachAttendeeId)) ||
      coachName(a.coachAttendeeId, attendees).localeCompare(coachName(b.coachAttendeeId, attendees)) ||
      a.coachAttendeeId.localeCompare(b.coachAttendeeId),
  );
  const panel = ranking.panelRefereesRanking;
  const count = Math.max(
    panel.rankedRefereeAttendeeIds.length,
    0,
    ...votes.map((vote) => vote.rankedRefereeAttendeeIds.length),
  );
  return {
    headers: [
      'Rank',
      'Panel referee',
      'Panel statistics',
      'Rank',
      ...votes.map((vote) => coachColumnLabel(vote, ranking, attendees)),
    ],
    rows: Array.from({ length: count }, (_, index) => [
      index + 1,
      refereeName(panel.rankedRefereeAttendeeIds[index], attendees),
      index < panel.stats.length ? `[${panel.stats[index].join(', ')}]` : '',
      index + 1,
      ...votes.map((vote) => refereeName(vote.rankedRefereeAttendeeIds[index], attendees)),
    ]),
  };
}

/** Shows only unlocked and practice annotations; a locked panel coach needs no suffix. */
function coachColumnLabel(
  vote: CoachRefereesRanking,
  ranking: TournamentRefereeRanking,
  attendees: ReadonlyMap<string, Attendee>,
): string {
  const annotations = [
    ...(vote.locked ? [] : ['Unlocked']),
    ...(ranking.selectedCoachAttendeeIds.includes(vote.coachAttendeeId) ? [] : ['Practice']),
  ];
  const name = coachName(vote.coachAttendeeId, attendees);
  return annotations.length ? `${name} (${annotations.join(', ')})` : name;
}

/** Exposes persisted freshness consistently in the toolbar and workbook. */
export function panelResultLabel(ranking: TournamentRefereeRanking): string {
  if (ranking.panelResultState === 'STALE') return 'Recompute required';
  return ranking.panelResultState === 'CURRENT'
    ? 'The panel ranking is current.'
    : 'No panel ranking has been computed.';
}

/** Retains absent CLOSED identities as placeholders and shorter lists as empty cells. */
function refereeName(id: string | undefined, attendees: ReadonlyMap<string, Attendee>): string {
  if (!id) return '';
  const attendee = attendees.get(id);
  return attendee ? rankingRefereeLabel(attendee) : 'Deleted referee';
}

/** Uses short names for column ordering, with an account-independent fallback. */
function coachName(id: string, attendees: ReadonlyMap<string, Attendee>): string {
  const person = attendees.get(id)?.person;
  return person?.shortName?.trim() || `${person?.firstName ?? ''} ${person?.lastName ?? ''}`.trim() || id;
}
