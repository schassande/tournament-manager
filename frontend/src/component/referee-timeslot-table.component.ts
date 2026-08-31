import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  Attendee,
  Field,
  Timeslot,
} from '@tournament-manager/persistent-data-model';
import { DateService } from '../service/date.service';
import {
  attendeeName,
  PlanningGame,
} from '../service/referee-planning-model';
import {
  PlanningExportTable,
  RefereePlanningService,
} from '../service/referee-planning.service';

/** Displays and exports the referee-by-timeslot planning matrix for an already filtered referee list. */
@Component({
  selector: 'app-referee-timeslot-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="planning-table-wrapper">
      <table class="planning-table">
        <thead>
          <tr>
            <th>
              @if (showExports()) {
                <i class="pi pi-file-pdf export-icon" role="button" tabindex="0"
                  (click)="exportPdf()" aria-label="Export PDF"
                  (keydown.enter)="exportPdf()" (keydown.space)="exportPdf()">
                </i>
                <i class="pi pi-file-excel export-icon" role="button" tabindex="0"
                  (click)="exportExcel()" aria-label="Export Excel"
                  (keydown.enter)="exportExcel()" (keydown.space)="exportExcel()">
                </i>
              }
            </th>
            @for (slot of timeslots(); track slot.id) {
              <th
                class="timeslot-header"
                [class.timeslot-highlight]="selectedTimeslotId() === slot.id"
                role="button"
                tabindex="0"
                [attr.aria-pressed]="selectedTimeslotId() === slot.id"
                (click)="toggleTimeslotHighlight(slot.id)"
                (keydown.enter)="toggleTimeslotHighlight(slot.id)"
                (keydown.space)="toggleTimeslotHighlight(slot.id); $event.preventDefault()"
              >
                {{ slotLabel(slot) }}
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @for (referee of referees(); track referee.id) {
            <tr>
              <th>{{ name(referee) }}</th>
              @for (slot of timeslots(); track slot.id) {
                @if (gameForCell(referee.id, slot.id); as game) {
                  <td
                    class="populated-cell"
                    [class.timeslot-highlight]="selectedTimeslotId() === slot.id"
                    [class.video-field]="game.field.video"
                    [class.bad-field]="game.field.quality === 1"
                    role="button"
                    tabindex="0"
                    (click)="cellSelected.emit({ gameId: game.game.id, refereeAttendeeId: referee.id })"
                    (keydown.enter)="cellSelected.emit({ gameId: game.game.id, refereeAttendeeId: referee.id })"
                    (keydown.space)="cellSelected.emit({ gameId: game.game.id, refereeAttendeeId: referee.id }); $event.preventDefault()"
                  >
                    {{ game.field.name }}
                    @if (game.field.video) {
                      <i class="pi pi-youtube" aria-hidden="true"></i>
                    }
                  </td>
                } @else {
                  <td [class.timeslot-highlight]="selectedTimeslotId() === slot.id"></td>
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
      .timeslot-highlight {
        background: #dbeafe !important;
      }
      .timeslot-header,
      .populated-cell {
        cursor: pointer;
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
export class RefereeTimeslotTableComponent {
  /** Referees to display, already filtered by the parent component. */
  readonly referees = input.required<Attendee[]>();
  readonly timeslots = input.required<Timeslot[]>();
  readonly games = input.required<PlanningGame[]>();
  readonly scopeLabel = input.required<string>();
  /** Controls whether PDF and Excel export icons are displayed. */
  readonly showExports = input(true);
  /** Emits the selected match and referee when a populated cell is activated. */
  readonly cellSelected = output<{ gameId: string; refereeAttendeeId: string }>();
  readonly selectedTimeslotId = signal<string | undefined>(undefined);
  private readonly dateService = inject(DateService);
  private readonly exports = inject(RefereePlanningService);

  /** Formats an attendee name. */
  name(referee: Attendee): string {
    return attendeeName(referee);
  }

  /** Formats a timeslot label. */
  slotLabel(slot: Timeslot): string {
    return this.dateService.toTime(slot.start);
  }

  /** Toggles the pale-blue highlight for one timeslot column. */
  toggleTimeslotHighlight(timeslotId: string): void {
    this.selectedTimeslotId.update((selectedId) => (selectedId === timeslotId ? undefined : timeslotId));
  }

  /** Finds the planning game assigned to a referee in a timeslot. */
  gameForCell(attendeeId: string, timeslotId: string): PlanningGame | undefined {
    return this.games().find(
      (game) =>
        game.timeslot.id === timeslotId &&
        game.referees.some((allocation) => allocation.attendeeId === attendeeId),
    );
  }

  /** Finds the field assigned to a referee in a timeslot. */
  fieldName(attendeeId: string, timeslotId: string): Field | undefined {
    return this.gameForCell(attendeeId, timeslotId)?.field;
  }

  /** Exports the displayed matrix as PDF. */
  exportPdf(): void {
    this.exports.exportPdf(this.exportTable(), `Referees List - ${this.scopeLabel()}`);
  }

  /** Exports the displayed matrix as Excel. */
  exportExcel(): void {
    this.exports.exportExcel(this.exportTable(), `referees-list-${this.scopeLabel()}`);
  }

  /** Builds the export rows from the already filtered list. */
  private exportTable(): PlanningExportTable {
    return {
      headers: ['Referee', ...this.timeslots().map((slot) => this.slotLabel(slot))],
      rows: this.referees().map((referee) => [
        this.name(referee),
        ...this.timeslots().map((slot) => this.fieldName(referee.id, slot.id)?.name ?? ''),
      ]),
    };
  }
}
