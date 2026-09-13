import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TableModule } from 'primeng/table';
import { Attendee, CoachRefereesRanking, TournamentRefereeRanking } from '@tournament-manager/persistent-data-model';
import { buildPanelTable } from './panel-table';

/** Displays the shared comparison; the page owns computation, export and save feedback. */
@Component({
  selector: 'app-ranking-panel',
  imports: [TableModule],
  templateUrl: './ranking-panel.component.html',
  styleUrl: './ranking-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RankingPanelComponent {
  readonly ranking = input.required<TournamentRefereeRanking>();
  readonly coachRankings = input.required<CoachRefereesRanking[]>();
  readonly attendees = input.required<ReadonlyMap<string, Attendee>>();
  readonly table = computed(() => buildPanelTable(this.ranking(), this.coachRankings(), this.attendees()));

  /** Explains a successfully saved empty result using the selected panel's contributing votes. */
  readonly emptyResultMessage = computed(() => {
    const ranking = this.ranking();
    if (ranking.panelResultState !== 'CURRENT' || ranking.panelRefereesRanking.rankedRefereeAttendeeIds.length)
      return '';
    const hasLockedVotes = this.coachRankings().some(
      (vote) => vote.locked && ranking.selectedCoachAttendeeIds.includes(vote.coachAttendeeId),
    );
    if (!hasLockedVotes) {
      const guidance = ranking.status === 'CLOSED' ? '' : ' Lock coach rankings in Coach Ranking, then compute again.';
      return `Panel computation saved with no results: no selected coach ranking is locked.${guidance}`;
    }
    return `Panel computation saved with no results: no referee reached the vote majority of ${ranking.voteMajority}. Only locked rankings of selected coaches count.`;
  });
}
