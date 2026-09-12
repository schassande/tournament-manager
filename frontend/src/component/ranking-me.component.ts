import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TournamentRefereeRanking } from '@tournament-manager/persistent-data-model';

/** Individual-tab shell; editing is delivered in the dedicated Me stage. */
@Component({
  selector: 'app-ranking-me',
  template: `
    @if (ranking().selectedRefereeAttendeeIds.length === 0) {
      <p>Configure referees first</p>
    } @else {
      <p>{{ ranking().selectedRefereeAttendeeIds.length }} referees to rank</p>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RankingMeComponent {
  readonly ranking = input.required<TournamentRefereeRanking>();
}
