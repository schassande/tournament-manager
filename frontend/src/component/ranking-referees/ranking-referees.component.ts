import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { PickListModule } from 'primeng/picklist';
import { SelectModule } from 'primeng/select';
import {
  Attendee,
  isRankingReferee,
  RankingRefereeChanges,
  TournamentRefereeRanking,
} from '@tournament-manager/persistent-data-model';

/** Local-only available-list filters; never modify selected membership. */
interface RefereeFilters {
  level: number | null;
  category: string | null;
  upgrade: boolean | null;
  gender: string | null;
}

/** Referees configuration UI. The parent page owns persistence and removal confirmation. */
@Component({
  selector: 'app-ranking-referees',
  imports: [FormsModule, ReactiveFormsModule, InputTextModule, PickListModule, SelectModule],
  templateUrl: './ranking-referees.component.html',
  styleUrl: './ranking-referees.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RankingRefereesComponent {
  readonly ranking = input.required<TournamentRefereeRanking>();
  readonly referees = input.required<Attendee[]>();
  readonly busy = input(false);
  readonly changes = output<RankingRefereeChanges>();
  readonly remove = output<string[]>();
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/\S/)] }),
    nbRefereesToRank: new FormControl(15, {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.min(1),
        (control) => (Number.isSafeInteger(control.value) ? null : { integer: true }),
      ],
    }),
  });
  readonly filters = signal<RefereeFilters>({ level: null, category: null, upgrade: null, gender: null });
  readonly categories = ['J', 'O', 'S', 'M'];
  readonly genders = ['M', 'F'];
  readonly upgrades = [
    { label: 'Seeking upgrade', value: true },
    { label: 'No upgrade', value: false },
  ];
  readonly disabled = computed(() => this.busy() || this.ranking().status === 'CLOSED');
  readonly levels = computed(() =>
    [
      ...new Set(
        this.referees()
          .map((item) => item.referee?.badge)
          .filter((level): level is number => level !== undefined),
      ),
    ].sort((a, b) => a - b),
  );
  // PickList mutates these view copies. Reset after every event, before persistence/confirmation.
  source: Attendee[] = [];
  target: Attendee[] = [];

  /** Synchronizes controls and disposable lists from the persisted page inputs. */
  constructor() {
    effect(() => {
      const ranking = this.ranking();
      this.form.patchValue({ name: ranking.name, nbRefereesToRank: ranking.nbRefereesToRank }, { emitEvent: false });
      if (this.disabled()) this.form.disable({ emitEvent: false });
      else this.form.enable({ emitEvent: false });
    });
    effect(() => {
      this.filters();
      this.resetLists();
    });
  }

  /** Emits a valid changed field on blur, leaving invalid edits visible for correction. */
  saveField(field: 'name' | 'nbRefereesToRank'): void {
    const control = this.form.controls[field];
    if (this.disabled() || control.invalid) return;
    const value = field === 'name' ? this.form.controls.name.value.trim() : this.form.controls.nbRefereesToRank.value;
    if (value !== this.ranking()[field]) this.changes.emit({ [field]: value });
  }

  /** Applies a filter only to the available list. */
  setFilter<K extends keyof RefereeFilters>(key: K, value: RefereeFilters[K]): void {
    this.filters.update((filters) => ({ ...filters, [key]: value }));
  }

  /** Emits additions while retaining selected referees hidden by the available-list filters. */
  addItems(items: Attendee[]): void {
    const ids = [
      ...new Set([
        ...this.ranking().selectedRefereeAttendeeIds,
        ...items.filter(isRankingReferee).map((item) => item.id),
      ]),
    ];
    this.resetLists();
    if (!this.disabled() && ids.length !== this.ranking().selectedRefereeAttendeeIds.length) {
      this.changes.emit({ selectedRefereeAttendeeIds: ids });
    }
  }

  /** Requests removal without changing the persisted selection shown in the PickList. */
  removeItems(items: Attendee[]): void {
    const ids = items.map((item) => item.id).filter((id) => this.ranking().selectedRefereeAttendeeIds.includes(id));
    this.resetLists();
    if (!this.disabled() && ids.length) this.remove.emit(ids);
  }

  /** Formats the Me-tab level/category/upgrade prefix, omitting Open and absent referee data. */
  refereePrefix(attendee: Attendee): string {
    const info = attendee.referee;
    if (!attendee.person || !info) return '';
    return `L${info.badge}${info.category === 'O' ? '' : (info.category ?? '')}${(info.upgrade?.badge ?? 0) > 0 ? '*' : ''}`;
  }

  /** Formats first name and uppercase surname, retaining the deleted-referee placeholder. */
  label(attendee: Attendee): string {
    return attendee.person
      ? `${attendee.person.firstName} ${attendee.person.lastName.toUpperCase()}`.trim()
      : 'Deleted referee';
  }

  /** Rebuilds disposable view arrays without mutating page inputs. */
  private resetLists(): void {
    const selected = new Set(this.ranking().selectedRefereeAttendeeIds);
    const byId = new Map(this.referees().map((item) => [item.id, item]));
    this.target = [...selected].map((id) => byId.get(id) ?? ({ id } as Attendee));
    this.source = this.referees()
      .filter((item) => isRankingReferee(item) && !selected.has(item.id) && this.matchesFilters(item))
      .sort((a, b) => this.label(a).localeCompare(this.label(b)));
  }

  /** Matches referee attributes against the four optional in-memory filters. */
  private matchesFilters(item: Attendee): boolean {
    const filter = this.filters();
    return (
      (filter.level === null || item.referee?.badge === filter.level) &&
      (filter.category === null || item.referee?.category === filter.category) &&
      (filter.upgrade === null || (item.referee?.upgrade?.badge ?? 0) > 0 === filter.upgrade) &&
      (filter.gender === null || item.person?.gender === filter.gender)
    );
  }
}
