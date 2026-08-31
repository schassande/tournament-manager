import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { CheckboxModule } from 'primeng/checkbox';
import { SelectModule } from 'primeng/select';
import { Attendee, Timeslot } from '@tournament-manager/persistent-data-model';
import { PlanningGame } from '../service/referee-planning-model';
import { RefereeTimeslotTableComponent } from './referee-timeslot-table.component';

/** Displays the referee-by-timeslot planning matrix and its filters. */
@Component({
  selector: 'app-referees-list',
  imports: [AutoCompleteModule, CheckboxModule, FormsModule, RefereeTimeslotTableComponent, SelectModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="filters">
      <div>
        <p-autocomplete
          aria-label="Search referees"
          placeholder="Search"
          [ngModel]="search()"
          (ngModelChange)="search.set($event ?? '')"
          [suggestions]="[]"
          [dropdown]="false"
          [showClear]="true"
        >
          <ng-template #loadingicon></ng-template>
        </p-autocomplete>
        <p-select
          [options]="levelOptions"
          optionLabel="label"
          optionValue="value"
          [ngModel]="level()"
          (ngModelChange)="level.set($event)"
          ariaLabel="Filter by level"
        />
        <p-select
          [options]="categoryOptions"
          optionLabel="label"
          optionValue="value"
          [ngModel]="category()"
          (ngModelChange)="category.set($event)"
          ariaLabel="Filter by category"
        />
        <p-select
          [options]="genderOptions"
          optionLabel="label"
          optionValue="value"
          [ngModel]="gender()"
          (ngModelChange)="gender.set($event)"
          ariaLabel="Filter by gender"
        />
        <label>
          <p-checkbox
            [ngModel]="upgradeOnly()"
            (ngModelChange)="upgradeOnly.set($event)"
            [binary]="true"
            inputId="upgrade-only"
          />
          Upgrade only
        </label>
        @if (allowPlayerReferees()) {
          <label>
            <p-checkbox
              [ngModel]="playerReferees()"
              (ngModelChange)="playerReferees.set($event)"
              [binary]="true"
              inputId="player-referees"
            />
            Player Referee
          </label>
        }
      </div>
    </div>
    <app-referee-timeslot-table
      [referees]="filteredReferees()"
      [timeslots]="timeslots()"
      [games]="games()"
      [scopeLabel]="scopeLabel()"
    />
  `,
  styles: [
    `
      .filters {
        display: grid;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
      }
      .filters > div {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        flex-wrap: wrap;
      }
      input,
      select {
        padding: 0.35rem;
      }
      label {
        white-space: nowrap;
      }
    `,
  ],
})
export class RefereesListComponent {
  readonly referees = input.required<Attendee[]>();
  readonly timeslots = input.required<Timeslot[]>();
  readonly games = input.required<PlanningGame[]>();
  readonly scopeLabel = input.required<string>();
  /** Indicates whether the tournament allows player referees. */
  readonly allowPlayerReferees = input(false);
  readonly levels = [1, 2, 3, 4, 5, 6];
  readonly levelOptions = [
    { label: 'All levels', value: '' },
    ...this.levels.map((level) => ({
      label: `Level ${level}`,
      value: String(level),
    })),
  ];
  readonly categories = [
    { value: 'J', label: 'Junior' },
    { value: 'O', label: 'Open' },
    { value: 'S', label: 'Senior' },
    { value: 'M', label: 'Master' },
  ];
  readonly categoryOptions = [
    { value: '', label: 'All categories' },
    ...this.categories,
  ];
  readonly genderOptions = [
    { value: '', label: 'All genders' },
    { value: 'M', label: 'Male' },
    { value: 'F', label: 'Female' },
  ];
  readonly search = signal('');
  readonly level = signal('');
  readonly category = signal('');
  readonly gender = signal('');
  readonly playerReferees = signal(false);
  readonly upgradeOnly = signal(false);
  readonly filteredReferees = computed(() =>
    this.referees()
      .filter((referee) => this.matches(referee))
      .sort((firstReferee, secondReferee) => {
        const firstPerson = firstReferee.person;
        const secondPerson = secondReferee.person;
        const firstNameComparison = (firstPerson?.firstName ?? '').localeCompare(
          secondPerson?.firstName ?? '',
          'fr',
          { sensitivity: 'base' },
        );

        return (
          firstNameComparison ||
          (firstPerson?.lastName ?? '').localeCompare(secondPerson?.lastName ?? '', 'fr', {
            sensitivity: 'base',
          })
        );
      }),
  );
  /** Applies all active list filters to one referee. */
  private matches(referee: Attendee): boolean {
    const text = this.search().toLowerCase();
    const info = referee.referee;
    return (
      (!text ||
        [
          referee.person?.firstName,
          referee.person?.lastName,
          referee.person?.shortName,
        ].some((value) => value?.toLowerCase().includes(text))) &&
      (!this.level() || info?.badge === Number(this.level())) &&
      (!this.category() || info?.category === this.category()) &&
      (!this.gender() || referee.person?.gender === this.gender()) &&
      (!this.playerReferees() || referee.isPlayer) &&
      (!this.upgradeOnly() || !!info?.upgrade)
    );
  }
}
