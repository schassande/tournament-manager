import { defaultSlotType, defaultSloTypes } from './../data.model';
import { CommonModule } from '@angular/common';
import { DateService } from '../service/date.service';
import { Component, effect, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';
import { InputNumberModule } from 'primeng/inputnumber';
import { Select } from "primeng/select";
import { SlotType } from '../data.model';

@Component({
  selector: 'app-tournament-day-timeslot-edit',
  imports: [CommonModule, DatePickerModule, FormsModule, InputNumberModule, Select],
  template: `
  <div class="timeslotBlock">
    <div class="timeslotStart">
      @if (timeslotStartReadOnly()) {
        <div style="text-align: center;">{{startTimeStr}}</div>
      } @else {
        <p-datepicker type="time" shape="round" [(ngModel)]="startTimeStr"
          (ionChange)="timeSlotStartChanged()" [timeOnly]="true">
        </p-datepicker>
      }
    </div>
    <div class="timeslotDuration">
      <p-select inputId="timeslotType" [options]="slotTypes" optionLabel="name" optionValue="id" [filter]=true
        [ngModel]="slotType().id" (onChange)="timslotTypeChanged($event.value)">
      </p-select>
    </div>
    <div class="actions">
      <i class="pi pi-plus action action-add"      aria-label="add time slot"    title="Add time slot after"   (click)="onAddTimeSlotAfter.emit()"></i>
      <i class="pi pi-trash action action-remove"  aria-label="remove time slot" title="Remove this time slot" (click)="onRemoveTimeSlot.emit()"></i>
    </div>
  </div>`,
  styles: [`
    .timeslotBlock {
      display: block;
      align-items: center;
      justify-content: space-between;
    }
    .timeslotStart, .timeslotDuration, .actions { display: inline-block; }
    .timeslotStart { width: 80px; display: inline-block;}
    .timeslotDuration { padding-right: 20px; }

    .duration-input { --p-inputnumber-button-width: 30px; }
    .duration-input .p-inputnumber-input,
    .duration-input .p-inputtext,
    input.p-inputnumber-input,
    .duration-input input { width: 65px !important; }

    .actions { float: right; margin-top: 8px; }
    .action {font-size: 1.2rem; margin-right: 10px; cursor: pointer; }
    .action-add {  color: green; }
    .action-remove { color: red; }
  `],
  standalone: true
})
export class TournamentDayTimeslotEditComponent {

  dateService = inject(DateService);
  timeslotStart = input.required<number>();
  timeslotStartReadOnly = input<boolean>(false);
  slotType = input.required<SlotType>()

  /** The use askes to add a new timeslot just after the current timeslot */
  onAddTimeSlotAfter = output<void>();
  /** The use askes to remove the current timeslot */
  onRemoveTimeSlot = output<void>();
  /**
   * The slot type of the current timeslot has been changed.
   * Value is the new slot type.
   * Timeslot has NOT been already updated.
   */
  onSlotTypeChange = output<SlotType>();
  /**
   * The start time of the current timeslot has been changed.
   * Value is the new start time (epoch value).
   * Timeslot has NOT already updated.
   */
  onTimeSlotStartChange = output<number>();

  /** Start time of the slot as string for display */
  startTimeStr: string = '';
  slotTypes = defaultSloTypes;

  constructor() {
    effect(() => {
      this.startTimeStr = this.dateService.toTime(this.timeslotStart());
    })
  }

  timeSlotStartChanged() {
    const start:number = this.dateService.fromTime(this.timeslotStart(), this.startTimeStr);
    console.log('timeSlotStartChanged', this.startTimeStr, start);
    this.onTimeSlotStartChange.emit(start);
  }
  timslotTypeChanged(id: string) {
    console.log('timslotTypeChanged', id);
    const st = this.slotTypes.find(s => s.id === id);
    if (st) {
      this.onSlotTypeChange.emit(st);
    }
  }
}
