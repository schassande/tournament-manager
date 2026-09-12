import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CoachRefereesRanking, TournamentRefereeRanking } from '@tournament-manager/persistent-data-model';

/** Panel-tab shell exposing persisted result state before the computation stage. */
@Component({
  selector: 'app-ranking-panel',
  template: `
    @if (ranking().selectedRefereeAttendeeIds.length === 0) {
      <p>Configure referees first</p>
    } @else {
      <p>{{ coachRankings().length }} coach rankings</p>
      @switch (ranking().panelResultState) {
        @case ('NOT_COMPUTED') {
          <p>No panel ranking has been computed.</p>
        }
        @case ('STALE') {
          <p>Recompute required</p>
        }
        @case ('CURRENT') {
          <p>The panel ranking is current.</p>
        }
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RankingPanelComponent {
  readonly ranking = input.required<TournamentRefereeRanking>();
  readonly coachRankings = input.required<CoachRefereesRanking[]>();
}
