import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { Field, Timeslot } from '@tournament-manager/persistent-data-model';
import {
  PlanningExportTable,
  RefereePlanningService,
} from '../service/referee-planning.service';
import { PlanningGame } from '../service/referee-planning-model';
import { DateService } from '../service/date.service';

/** Displays matches and referee assignments by field and timeslot. */
@Component({
  selector: 'app-referees-planning',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="planning-table-wrapper">
      <table class="planning-table">
        <thead>
          <tr>
            <th class="corner-cell">
              <i
                class="pi pi-file-pdf export-icon"
                role="button"
                tabindex="0"
                (click)="exportPdf()"
                aria-label="Export PDF"
                (keydown.enter)="exportPdf()"
                (keydown.space)="exportPdf()"
              ></i>
              <i
                class="pi pi-file-excel export-icon"
                role="button"
                tabindex="0"
                (click)="exportExcel()"
                aria-label="Export Excel"
                (keydown.enter)="exportExcel()"
                (keydown.space)="exportExcel()"
              ></i>
            </th>
            @for (field of displayedFields(); track field.id) {
              <th>
                {{ field.name }}
                @if (field.video) {
                  <i class="pi pi-youtube" aria-hidden="true"></i>
                }
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @for (timeslot of timeslots(); track timeslot.id) {
            <tr>
              <th>{{ timeslotLabel(timeslot) }}</th>
              @for (field of displayedFields(); track field.id) {
                @if (game(timeslot, field); as match) {
                  <td>
                    <div class="match-title"
                      [style.background-color]="match.divisionBackgroundColor"
                      [style.color]="match.divisionFontColor">
                      {{ matchDescription(match) }}
                    </div>
                    <div class="match-referees">
                      @for (referee of match.referees; track referee.id) {
                        <div>{{ refereeName(referee) }}</div>
                      }
                    </div>
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
      .planning-table-wrapper {
        max-width: 100%;
        max-height: calc(100vh - 110px);
        overflow-x: auto;
        overflow-y: auto;
        width: 100%;
      }
      .planning-table {
        border-collapse: collapse;
        width: max-content;
        margin-bottom: 30px;
      }
      th,
      td {
        border: 1px solid #999;
        text-align: center;
        vertical-align: top;
        min-width: 130px;
        padding: 0;
      }
      .match-title {
        padding: 0.2rem 0.3rem;
        text-align: center;
        width: 100%;
      }
      .match-referees {
        padding: 0.1rem 0.25rem;
        min-height: 50px;
      }
      thead th {
        position: sticky;
        top: 0;
        z-index: 2;
        background: #f5f5f5;
      }
      tbody th,
      .corner-cell {
        position: sticky;
        left: 0;
        z-index: 1;
        background: #f5f5f5;
      }
      .planning-table tbody th {
        width: 60px;
        min-width: 60px;
        max-width: 60px;
      }
      .corner-cell {
        z-index: 3;
        width: 60px;
        min-width: 60px;
        max-width: 60px;
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
export class RefereesPlanningComponent {
  readonly fields = input.required<Field[]>();
  readonly timeslots = input.required<Timeslot[]>();
  readonly games = input.required<PlanningGame[]>();
  readonly attendeeNames = input.required<Record<string, string>>();
  readonly scopeLabel = input.required<string>();
  readonly displayedFields = computed(() =>
    this.fields().filter((field) =>
      this.games().some((game) => game.field.id === field.id),
    ),
  );
  private readonly dateService = inject(DateService);

  constructor(private readonly exports: RefereePlanningService) {}

  /** Finds the match at a field and timeslot. */
  game(timeslot: Timeslot, field: Field): PlanningGame | undefined {
    return this.games().find(
      (item) => item.timeslot.id === timeslot.id && item.field.id === field.id,
    );
  }
  /** Formats a timeslot label. */
  timeslotLabel(timeslot: Timeslot): string {
    return this.dateService.toTime(timeslot.start);
  }
  /** Formats the match description. */
  matchDescription(game: PlanningGame): string {
    return [game.divisionName, game.game.what, game.homeTeamName, game.awayTeamName]
      .filter(Boolean)
      .join(' - ');
  }
  /** Formats a referee name. */
  refereeName(allocation: { attendeeId: string }): string {
    return this.attendeeNames()[allocation.attendeeId] ?? allocation.attendeeId;
  }
  /** Exports the visible table as PDF. */
  exportPdf(): void {
    this.exports.exportPdf(
      this.exportTable(),
      `Referees Planning - ${this.scopeLabel()}`,
    );
  }
  /** Exports the visible table as Excel. */
  exportExcel(): void {
    this.exports.exportExcel(
      this.exportTable(),
      `referees-planning-${this.scopeLabel()}`,
    );
  }
  /** Builds the export rows from the currently rendered scope. */
  private exportTable(): PlanningExportTable {
    return {
      headers: ['Timeslot', ...this.displayedFields().map((field) => field.name)],
      rows: this.timeslots().map((slot) => [
        this.timeslotLabel(slot),
        ...this.displayedFields().map((field) => {
          const game = this.game(slot, field);
          return game ? this.matchDescription(game) : '';
        }),
      ]),
    };
  }
}
