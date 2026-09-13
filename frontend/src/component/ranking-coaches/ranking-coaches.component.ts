import { ChangeDetectionStrategy, Component, computed, effect, input, output } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { Attendee, RankingCoachChanges, TournamentRefereeRanking } from '@tournament-manager/persistent-data-model';

/** Panel configuration using page-owned attendees and persistence, without individual-record writes. */
@Component({
  selector: 'app-ranking-coaches',
  imports: [ReactiveFormsModule, CheckboxModule, InputTextModule, TooltipModule],
  templateUrl: './ranking-coaches.component.html',
  styleUrl: './ranking-coaches.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RankingCoachesComponent {
  readonly ranking = input.required<TournamentRefereeRanking>();
  readonly coaches = input.required<Attendee[]>();
  readonly busy = input(false);
  readonly changes = output<RankingCoachChanges>();
  readonly selectionControls = computed(
    () =>
      new Map(
        this.sortedCoaches().map((coach) => [
          coach.id,
          new FormControl(this.ranking().selectedCoachAttendeeIds.includes(coach.id), { nonNullable: true }),
        ]),
      ),
  );
  readonly majority = new FormControl(1, {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.min(1),
      (control) => (Number.isSafeInteger(control.value) ? null : { integer: true }),
    ],
  });
  readonly disabled = computed(() => this.busy() || this.ranking().status === 'CLOSED');
  readonly sortedCoaches = computed(() =>
    this.coaches()
      .filter((coach) => coach.isRefereeCoach && coach.tournamentId === this.ranking().tournamentId)
      .sort((a, b) => this.label(a).localeCompare(this.label(b)) || a.id.localeCompare(b.id)),
  );

  /** Restores the persisted threshold on save completion, failure or ranking selection. */
  constructor() {
    effect(() => {
      this.majority.setValue(this.ranking().voteMajority, { emitEvent: false });
      if (this.disabled()) this.majority.disable({ emitEvent: false });
      else this.majority.enable({ emitEvent: false });
      this.selectionControls().forEach((control) => {
        if (this.disabled()) control.disable({ emitEvent: false });
        else control.enable({ emitEvent: false });
      });
    });
  }

  /** Displays each coach's full name with an ID fallback for incomplete attendee data. */
  label(coach: Attendee): string {
    return `${coach.person?.firstName ?? ''} ${coach.person?.lastName?.toUpperCase() ?? ''}`.trim() || coach.id;
  }

  /** Explains missing account data using the email recorded on the attendee. */
  coachWarning(coach: Attendee): string {
    if (coach.person?.personId?.trim()) return 'Missing person link or email';
    const email = coach.person?.email?.trim();
    return email ? `No account for the email ${email}` : 'Configure the coach to set a person with an account';
  }

  /** Emits proposed membership; the page handles confirmation and commits the displayed selection. */
  toggleCoach(coach: Attendee, selected: boolean, event?: Event): void {
    // A native click already changed the input; restore it even when Angular's binding value is unchanged.
    if (event?.target instanceof HTMLInputElement) {
      event.target.checked = this.ranking().selectedCoachAttendeeIds.includes(coach.id);
    }
    this.selectionControls()
      .get(coach.id)
      ?.setValue(this.ranking().selectedCoachAttendeeIds.includes(coach.id), { emitEvent: false });
    if (this.disabled() || !this.sortedCoaches().some((item) => item.id === coach.id)) return;
    const ids = this.ranking().selectedCoachAttendeeIds;
    if (ids.includes(coach.id) === selected) return;
    this.changes.emit({
      selectedCoachAttendeeIds: selected ? [...ids, coach.id] : ids.filter((id) => id !== coach.id),
    });
  }

  /** Saves a changed positive safe integer on blur, without capping it by panel size. */
  saveMajority(): void {
    if (!this.disabled() && this.majority.valid && this.majority.value !== this.ranking().voteMajority) {
      this.changes.emit({ voteMajority: this.majority.value });
    }
  }
}
