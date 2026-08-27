import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Attendee, Timeslot } from '@tournament-manager/persistent-data-model';
import { attendeeName } from '../service/referee-planning-model';
import { DateService } from '../service/date.service';
import {
  PlanningExportTable,
  PlanningExportCellStyle,
  RefereePlanningService,
} from '../service/referee-planning.service';
import { PlanningGame } from '../service/referee-planning-model';

/** Displays the match planning grouped by referee coach. */
@Component({
  selector: 'app-coaches-planning',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="planning-table-wrapper">
      <table class="planning-table">
        <thead>
          <tr>
            <th>
              <i class="pi pi-file-pdf export-icon"
                role="button"
                tabindex="0"
                (click)="exportPdf()"
                aria-label="Export PDF"
                (keydown.enter)="exportPdf()"
                (keydown.space)="exportPdf()">
                </i>
              <i class="pi pi-file-excel export-icon"
                role="button"
                tabindex="0"
                (click)="exportExcel()"
                aria-label="Export Excel"
                (keydown.enter)="exportExcel()"
                (keydown.space)="exportExcel()">
              </i>
            </th>
            @for (coach of coaches(); track coach.id) {
              <th>{{ name(coach) }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (slot of timeslots(); track slot.id) {
            <tr>
              <th>{{ slotLabel(slot) }}</th>
              @for (coach of coaches(); track coach.id) {
                <td>
                  @if (game(slot, coach.id); as match) {
                    <div class="game-line"
                      [style.background-color]="match.divisionBackgroundColor"
                      [style.color]="match.divisionFontColor">
                      <span [class.video-field]="match.field.video">
                        {{ match.field.name}} 
                        @if (match.field.video) {
                          <i class="pi pi-youtube" aria-hidden="true"></i>
                        }
                      </span>
                      - {{ description(match) }}
                    </div>
                    @for (referee of match.referees; track referee.id) {
                      <div class="referee-line">
                        @if (attendeeLevels()[referee.attendeeId]; as level) {
                          <span class="referee-level"
                            [style.background-color]="attendeeBadgeColors()[referee.attendeeId].backgroundColor"
                            [style.color]="attendeeBadgeColors()[referee.attendeeId].color">
                            {{ level }}
                          </span>
                        }
                        {{ attendeeNames()[referee.attendeeId] || '?' }}
                      </div>
                    }
                  } @else {
                    <div class="empty-cell"></div>
                  }
                </td>
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
        overflow: auto;
        max-height: calc(100vh - 130px);
      }
      .planning-table {
        border-collapse: collapse;
        width: max-content;
      }
      th,
      td {
        border: 1px solid #999;
        text-align: center;
        vertical-align: top;
        padding: 0;
        min-height: 50px;
      }
      thead th,
      tbody th {
        padding: 5px;
      }
      thead th {
        position: sticky;
        top: 0;
        z-index: 2;
        background: #f5f5f5;
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
      .game-line {
        padding: 0.2rem 0.3rem;
        text-align: center;
        width: 100%;
      }
      .referee-line {
        padding: 0.1rem 0.25rem;
        text-align: center;
        overflow-wrap: anywhere;
      }
      .referee-level {
        display: inline-block;
        margin-right: 0.25rem;
        padding: 0 0.2rem;
      }
      .empty-cell {
        min-height: 50px;
      }
      .video-field {
        font-weight: 700;
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
export class CoachesPlanningComponent {
  readonly coaches = input.required<Attendee[]>();
  readonly timeslots = input.required<Timeslot[]>();
  readonly games = input.required<PlanningGame[]>();
  readonly attendeeNames = input.required<Record<string, string>>();
  readonly attendeeLevels = input.required<Record<string, string>>();
  readonly attendeeBadgeColors = input.required<
    Record<string, { backgroundColor: string; color: string }>
  >();
  readonly scopeLabel = input.required<string>();
  private readonly dateService = inject(DateService);

  constructor(private readonly exports: RefereePlanningService) {}
  /** Formats an attendee name. */
  name(attendee: Attendee): string {
    return attendeeName(attendee);
  }
  /** Formats a timeslot label. */
  slotLabel(slot: Timeslot): string {
    return this.dateService.toTime(slot.start);
  }
  /** Finds a game coached by an attendee in a timeslot. */
  game(slot: Timeslot, coachId: string): PlanningGame | undefined {
    return this.games().find(
      (item) =>
        item.timeslot.id === slot.id &&
        item.coaches.some((allocation) => allocation.attendeeId === coachId),
    );
  }
  /** Formats a match description. */
  description(game: PlanningGame): string {
    return [game.divisionName, game.game.what, game.homeTeamName, game.awayTeamName]
      .filter(Boolean)
      .join(' - ');
  }
  /** Exports the visible matrix as PDF. */
  exportPdf(): void {
    this.exports.exportPdf(
      this.exportTable(),
      `Coaches - ${this.scopeLabel()}`,
    );
  }
  /** Exports the visible matrix as Excel. */
  exportExcel(): void {
    this.exports.exportExcel(
      this.exportTable(),
      `coaches-${this.scopeLabel()}`,
    );
  }
  /** Builds the export rows from the currently rendered scope. */
  private exportTable(): PlanningExportTable {
    const rows = this.timeslots().map((slot) => [
      this.slotLabel(slot),
      ...this.coaches().map((coach) => {
        const game = this.game(slot, coach.id);
        return game
          ? [
              `${game.field.name} - ${this.description(game)}`,
              ...game.referees.map(
                (referee) => this.refereeLabel(referee.attendeeId),
              ),
            ].join('\n')
          : '';
      }),
    ]);
    const cellTitleStyles: Array<Array<PlanningExportCellStyle | undefined>> = this.timeslots().map(
      (slot) => [
        undefined,
        ...this.coaches().map((coach) => {
          const game = this.game(slot, coach.id);
          return game
            ? {
                backgroundColor: game.divisionBackgroundColor,
                color: game.divisionFontColor,
              }
            : undefined;
        }),
      ],
    );

    return {
      headers: ['Timeslot', ...this.coaches().map((coach) => this.name(coach))],
      rows,
      cellTitleStyles,
    };
  }

  /** Formats an exported referee level and identity. */
  private refereeLabel(attendeeId: string): string {
    return [
      this.attendeeLevels()[attendeeId],
      this.attendeeNames()[attendeeId] || '?',
    ]
      .filter(Boolean)
      .join(' ');
  }
}
