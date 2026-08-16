import {
  Attendee,
  Day,
  PartDay,
  PartDayUnavailability,
  Timeslot,
  Tournament,
  createPartDayUnavailability,
  findPartDayUnavailability,
  isSlotUnavailable,
  normalizePartDayUnavailabilities,
} from '@tournament-manager/persistent-data-model';
import { ChangeDetectionStrategy, Component, Input, OnInit, inject } from '@angular/core';
import { DateService } from '../service/date.service';

type AvailabilityState = 'available' | 'partial' | 'total';

/**
 * Reusable editor for attendee availability exceptions over a tournament schedule.
 * The component updates the attendee in memory; its parent remains responsible for
 * persisting the attendee when the surrounding editor is closed.
 */
@Component({
  selector: 'app-attendee-unavailability',
  template: `
    <div class="availability-grid" aria-label="Attendee availability">
      @for (day of tournament.days; track day.id) {
        <section class="day-column">
          <button
            type="button"
            class="day-header"
            [class.available]="dayState(day) === 'available'"
            [class.partial]="dayState(day) === 'partial'"
            [class.total]="dayState(day) === 'total'"
            [attr.aria-label]="dayLabel(day) + ' availability'"
            (click)="toggleDay(day)"
          >
            {{ dayLabel(day) }}
          </button>

          @for (partDay of day.parts; track partDay.id) {
            @if (partDay.timeslots.length > 0) {
              @if (hasMultiplePartDays(day)) {
                <button
                  type="button"
                  class="part-day-header"
                  [class.available]="partDayState(day, partDay) === 'available'"
                  [class.partial]="partDayState(day, partDay) === 'partial'"
                  [class.total]="partDayState(day, partDay) === 'total'"
                  [attr.aria-label]="partDayLabel(day, partDay) + ' availability'"
                  (click)="togglePartDay(day, partDay)"
                >
                  {{ partDayLabel(day, partDay) }}
                </button>
              }

              @for (slot of partDay.timeslots; track slot.id) {
                <button
                  type="button"
                  class="slot-cell"
                  [class.available]="!slotUnavailable(day, partDay, slot)"
                  [class.unavailable]="slotUnavailable(day, partDay, slot)"
                  [attr.aria-label]="slotLabel(day, partDay, slot)"
                  (click)="toggleSlot(day, partDay, slot)"
                >
                  {{ dateService.toTime(slot.start) }}
                </button>
              }
            }
          }
        </section>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .availability-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 4px;
      max-width: 100%;
      width: fit-content;
    }
    .day-column {
      display: flex;
      flex: 0 1 100px;
      flex-direction: column;
      gap: 1px;
      max-width: 100px;
      min-width: 0;
      width: 100px;
    }
    .day-header, .part-day-header, .slot-cell {
      border: 1px solid #d1d5db;
      color: #fff;
      cursor: pointer;
      font: inherit;
      min-height: 1.5rem;
      min-width: 0;
      overflow: hidden;
      padding: 2px 4px;
      text-overflow: ellipsis;
      white-space: nowrap;
      width: 100%;
    }
    .day-header:focus-visible, .part-day-header:focus-visible, .slot-cell:focus-visible {
      outline: 3px solid #2563eb;
      outline-offset: 1px;
    }
    .day-header { font-size: 1.2rem; font-weight: 700; }    .part-day-header { font-weight: 600; margin-top: 3px; }
    .slot-cell { text-align: center; }
    .available { background: #198754; }
    .partial { background: #f59e0b; }
    .total, .unavailable { background: #dc3545; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttendeeUnavailabilityComponent implements OnInit {
  private readonly _dateService = inject(DateService);

  @Input() attendee!: Attendee;
  @Input() tournament!: Tournament;

  /** Exposes date formatting to the template without creating a second service. */
  readonly dateService = this._dateService;

  ngOnInit(): void {
    const normalized = normalizePartDayUnavailabilities(
      this.tournament.days,
      this.attendee.unavailabilities,
    );
    if (normalized) this.attendee.unavailabilities = normalized;
    else delete this.attendee.unavailabilities;
  }

  /** Returns the state summarized by a day header. */
  dayState(day: Day): AvailabilityState {
    const partDays = day.parts.filter(partDay => partDay.timeslots.length > 0);
    const states = partDays.map(partDay => this.partDayState(day, partDay));
    if (states.length === 0 || states.every(state => state === 'available')) return 'available';
    if (states.every(state => state === 'total')) return 'total';
    return 'partial';
  }

  /** Returns the state summarized by a part-day header. */
  partDayState(day: Day, partDay: PartDay): AvailabilityState {
    const entry = this.entry(day, partDay);
    if (!entry) return 'available';
    if (entry.unavailability === 'TOTAL') return 'total';
    return entry.unavailableSlotIds.length === partDay.timeslots.length ? 'total' : 'partial';
  }

  /** Returns whether a day has multiple part-days that can be displayed. */
  hasMultiplePartDays(day: Day): boolean {
    return day.parts.filter(partDay => partDay.timeslots.length > 0).length > 1;
  }

  /** Returns whether a particular slot is currently unavailable. */
  slotUnavailable(day: Day, partDay: PartDay, slot: Timeslot): boolean {
    return isSlotUnavailable(this.entry(day, partDay), slot.id);
  }

  /** Toggles one slot and re-normalizes its part-day entry. */
  toggleSlot(day: Day, partDay: PartDay, slot: Timeslot): void {
    const entry = this.entry(day, partDay);
    const currentIds = entry?.unavailability === 'TOTAL'
      ? partDay.timeslots.map(item => item.id)
      : [...(entry?.unavailableSlotIds ?? [])];
    const slotIndex = currentIds.indexOf(slot.id);
    if (slotIndex >= 0) currentIds.splice(slotIndex, 1);
    else currentIds.push(slot.id);
    this.replacePartDayEntry(day, partDay, currentIds);
  }

  /** Sets every slot of a part-day to available or unavailable. */
  togglePartDay(day: Day, partDay: PartDay): void {
    const state = this.partDayState(day, partDay);
    const unavailableSlotIds = state === 'available'
      ? partDay.timeslots.map(slot => slot.id)
      : [];
    this.replacePartDayEntry(day, partDay, unavailableSlotIds);
  }

  /** Sets every slot of a day to available or unavailable. */
  toggleDay(day: Day): void {
    const state = this.dayState(day);
    const unavailable = state === 'available';
    const entries = (this.attendee.unavailabilities ?? [])
      .filter(entry => entry.dayId !== day.id);
    if (unavailable) {
      for (const partDay of day.parts) {
        if (partDay.timeslots.length > 0) {
          entries.push({
            dayId: day.id,
            partDayId: partDay.id,
            unavailability: 'TOTAL',
            unavailableSlotIds: [],
          });
        }
      }
    }
    this.setEntries(entries);
  }

  /** Formats the day title. */
  dayLabel(day: Day): string {
    return `Day ${day.id}`;
  }

  /** Formats the part-day title. */
  partDayLabel(day: Day, partDay: PartDay): string {
    return `Part ${partDay.id}`;
  }

  /** Formats a slot accessible name. */
  slotLabel(day: Day, partDay: PartDay, slot: Timeslot): string {
    return `${this.dayLabel(day)}, ${this.partDayLabel(day, partDay)}, ${this.dateService.toTime(slot.start)}`;
  }

  private entry(day: Day, partDay: PartDay): PartDayUnavailability | undefined {
    return findPartDayUnavailability(this.attendee.unavailabilities, day.id, partDay.id);
  }

  private replacePartDayEntry(day: Day, partDay: PartDay, unavailableSlotIds: string[]): void {
    const entries = (this.attendee.unavailabilities ?? [])
      .filter(entry => !(entry.dayId === day.id && entry.partDayId === partDay.id));
    const entry = createPartDayUnavailability(day.id, partDay, unavailableSlotIds);
    if (entry) entries.push(entry);
    this.setEntries(entries);
  }

  private setEntries(entries: PartDayUnavailability[]): void {
    const normalized = normalizePartDayUnavailabilities(
      this.tournament.days,
      entries,
    );
    if (normalized) this.attendee.unavailabilities = normalized;
    else delete this.attendee.unavailabilities;
  }
}
