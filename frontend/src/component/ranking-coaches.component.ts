import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Attendee, TournamentRefereeRanking } from '@tournament-manager/persistent-data-model';

/** Coach-tab shell displaying the shared configuration without additional reads. */
@Component({
  selector: 'app-ranking-coaches',
  template: `
    <p>{{ ranking().selectedCoachAttendeeIds.length }} selected / {{ coaches().length }} referee coaches</p>
    <p>Vote majority: {{ ranking().voteMajority }} / {{ ranking().selectedCoachAttendeeIds.length }}</p>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RankingCoachesComponent {
  readonly ranking = input.required<TournamentRefereeRanking>();
  readonly coaches = input.required<Attendee[]>();
}
