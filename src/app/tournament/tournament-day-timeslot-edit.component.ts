import { DateService } from './../shared/services/date.service';
import { Component, effect, inject, input, output } from '@angular/core';

@Component({
  selector: 'app-tournament-day-timeslot-edit',
  template: `
  <div class="timeslotBlock">
    <span class="timeslotStart">
      <ion-input type="time" shape="round" [(ngModel)]="startTimeStr"
      (ionChange)="timeSlotStartChanged()"></ion-input>
    </span>
    <span class="timeslotDuration">
      <p-inputnumber inputId="integeronly" [showButtons]="true" size="small"
        min="1" max="120" step="1" suffix=" min"
        [(ngModel)]="duration" (onInput)="onDurationChange()">
      </p-inputnumber>
    </span>
    <span class="actions">
      <i class="pi pi-plus action-add"      aria-label="add time slot"    (click)="addTimeSlotAfter()"></i>
      <i class="pi pi-trash action-remove"  aria-label="remove time slot" (click)="removeTimeSlot()"></i>
    </span>
  </div>`,
  styles: [`
    .timeslotStart { padding: 5px; width: 85px; display: inline-block; height: 0;}
    .timeslotDuration { padding: 5px; }
    .timeslotAction {}
    .actions { float: right; margin-top: 18px;}
    .action-add { font-size: 1rem; color: green; margin-right: 5px; }
    .action-remove { font-size: 1rem; color: red; }
  `],
  standalone: false
})
export class TournamentDayTimeslotEditComponent {

  // timeslot = input.required<Timeslot>();
  timeslotId = input.required<string>();
  timeslotStart = input.required<number>();
  timeslotDuration = input.required<number>();

  /** The use askes to add a new timeslot just after the current timeslot */
  onAddTimeSlotAfter = output<void>();
  /** The use askes to remove the current timeslot */
  onRemoveTimeSlot = output<void>();
  /**
   * The duration of the current timeslot has been changed.
   * Value is the new duration.
   * Timeslot has been already updated (duration & end).
   */
  onDuractionChange = output<number>();
  /**
   * The start time of the current timeslot has been changed.
   * Value is the new start time (epoch value).
   * Timeslot has been already updated (start & end).
   */
  onTimeSlotStartChange = output<number>();

  /** Duration in minutes */
  duration: number= 0;
  /** Start time of the slot as string for disply */
  startTimeStr: string = '';

  dateService = inject(DateService);

  constructor() {
    effect(() => {
      this.duration = this.timeslotDuration() / (60 * 1000);
      this.startTimeStr = this.dateService.toTime(this.timeslotStart());
      // console.debug('effect TS', this.timeslotId(), this.duration, this.startTimeStr);
    })
  }

  timeSlotStartChanged() {
    const start = this.dateService.fromTime(this.timeslotStart(), this.startTimeStr);
    console.log('timeSlotStartChanged', this.startTimeStr, start);
    this.onTimeSlotStartChange.emit(start);
  }
  addTimeSlotAfter() { this.onAddTimeSlotAfter.emit(); }
  removeTimeSlot() { this.onRemoveTimeSlot.emit(); }
  onDurationChange() {
    this.onDuractionChange.emit(this.duration * 60 * 1000);
  }
}
