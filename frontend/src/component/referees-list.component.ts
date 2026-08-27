import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { CheckboxModule } from 'primeng/checkbox';
import { SelectModule } from 'primeng/select';
import {
  Attendee,
  Field,
  Timeslot,
} from '@tournament-manager/persistent-data-model';
import { attendeeName } from '../service/referee-planning-model';
import { DateService } from '../service/date.service';
import {
  PlanningExportTable,
  RefereePlanningService,
} from '../service/referee-planning.service';
import { PlanningGame } from '../service/referee-planning-model';

/** Displays the referee-by-timeslot planning matrix and its filters. */
@Component({
  selector: 'app-referees-list',
  imports: [AutoCompleteModule, CheckboxModule, FormsModule, SelectModule],
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
    <div class="planning-table-wrapper">
      <table class="planning-table">
        <thead>
          <tr>
            <th>
              <i class="pi pi-file-pdf export-icon" role="button" tabindex="0"
                (click)="exportPdf()" aria-label="Export PDF"
                (keydown.enter)="exportPdf()" (keydown.space)="exportPdf()">
              </i>
              <i class="pi pi-file-excel export-icon" role="button" tabindex="0"
                (click)="exportExcel()" aria-label="Export Excel"
                (keydown.enter)="exportExcel()" (keydown.space)="exportExcel()">
              </i>
            </th>
            @for (slot of timeslots(); track slot.id) {
              <th>{{ slotLabel(slot) }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (referee of filteredReferees(); track referee.id) {
            <tr>
              <th>{{ name(referee) }}</th>
              @for (slot of timeslots(); track slot.id) {
                @if (fieldName(referee.id, slot.id); as field) {
                  <td [class.video-field]="field.video" [class.bad-field]="field.quality === 1">
                    {{ field.name }}
                    @if (field.video) {
                      <i class="pi pi-youtube" aria-hidden="true"></i>
                    }
                  </td>
                } @else { 
                  <td></td>
                }
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
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
      .planning-table-wrapper {
        overflow: auto;
        max-height: calc(100vh - 260px);
      }
      .planning-table {
        border-collapse: collapse;
        width: max-content;
      }
      th,
      td {
        border: 1px solid #bbb;
        padding: 0.45rem;
        white-space: nowrap;
      }
      thead th {
        position: sticky;
        top: 0;
        z-index: 2;
        background: #f5f5f5;
      }
      tbody th {
        text-align: left;
      }
      tbody td {
        text-align: center;
      }
      tbody th,
      thead th:first-child {
        position: sticky;
        left: 0;
        z-index: 1;
        background: #f5f5f5;
      }
      thead th:first-child {
        z-index: 3;
      }
      .video-field {
        font-weight: 700;
      }
      .bad-field {
        display: block;
        background: #f8d7da;
      }
      .export-icon {
        cursor: pointer;
        margin: 2px;
      }
      .export-icon:focus-visible {
        outline: 2px solid currentColor;
        outline-offset: 2px;
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
  private readonly dateService = inject(DateService);

  constructor(private readonly exports: RefereePlanningService) {}
  /** Formats an attendee name. */
  name(referee: Attendee): string {
    return attendeeName(referee);
  }
  /** Formats a timeslot label. */
  slotLabel(slot: Timeslot): string {
    return this.dateService.toTime(slot.start);
  }
  /** Finds the field assigned to a referee in a timeslot. */
  fieldName(attendeeId: string, timeslotId: string): Field | undefined {
    return this.games().find(
      (game) =>
        game.timeslot.id === timeslotId &&
        game.referees.some(
          (allocation) => allocation.attendeeId === attendeeId,
        ),
    )?.field;
  }
  /** Exports the filtered matrix as PDF. */
  exportPdf(): void {
    this.exports.exportPdf(
      this.exportTable(),
      `Referees List - ${this.scopeLabel()}`,
    );
  }
  /** Exports the filtered matrix as Excel. */
  exportExcel(): void {
    this.exports.exportExcel(
      this.exportTable(),
      `referees-list-${this.scopeLabel()}`,
    );
  }
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
  /** Builds the export rows from the filtered list. */
  private exportTable(): PlanningExportTable {
    return {
      headers: [
        'Referee',
        ...this.timeslots().map((slot) => this.slotLabel(slot)),
      ],
      rows: this.filteredReferees().map((referee) => [
        this.name(referee),
        ...this.timeslots().map(
          (slot) => this.fieldName(referee.id, slot.id)?.name ?? '',
        ),
      ]),
    };
  }
}
