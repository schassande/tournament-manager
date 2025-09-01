import { ChangeDetectorRef, Component, computed, effect, inject, input, model, output, } from '@angular/core';
import { DateService } from '../service/date.service';
import { Day, defaultSlotType, PartDay, Timeslot, SlotType } from '../data.model';
import { CardModule } from 'primeng/card';
import { FormsModule } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';
import { CommonModule } from '@angular/common';
import { TournamentDayTimeslotEditComponent } from './tournament-day-timeslot-edit.component';
import { TimeslotService } from '../service/timeslot.service';

@Component({
  selector: 'app-tournament-day-edit',
  imports: [CardModule, CommonModule, FormsModule, DatePickerModule, TournamentDayTimeslotEditComponent],
  template: `
  <p-card class="dayCard">
    <ng-template #header>
      <div class="dayId" [ngClass]="{ severalDayId : isLastDay() && hasSeveralDays() }">
        <span>Day {{day().id}}</span>
        @if (isLastDay() && hasSeveralDays()) {
        <div class="actions actions-day">
          <i class="pi pi-trash  action-remove" aria-label="remove day"  (click)="removeDay()"></i>
        </div>
        }
      </div>
      <div class="dayDate">
        <p-date-picker type="date" [(ngModel)]="dayDate"  required="true" [firstDayOfWeek]="1" showButtonBar="true"
          (onSelect)="onDateChange()" dateFormat="yy/mm/dd" [showIcon]="true" [required]="true"
          [readonlyInput]="!isFirstDay()" style="text-align: center;"></p-date-picker>
      </div>
      <div class="dayOfWeek">{{dayOfWeek()}}</div>
      <div style="clear: both;"></div>
    </ng-template>
    @if (day()) {
    <div class="dayBody">
      @for(part of day().parts; let isLastPart = $last; track part.id; let isFirstPart = $first) {
        <div class="partBlock" [ngClass]="{ firstParts : !isLastPart && day().parts.length > 1 }">
          <div class="partHeader">
            @if (isLastPart) {
              <div class="actions">
                <i class="pi pi-plus action-add"     aria-label="add part"     (click)="addPartAfter(part.id)"></i>
                @if (day().parts.length > 1) {
                  <i class="pi pi-trash action-remove" aria-label="remove part"  (click)="removePart(part.id)"></i>
                }
              </div>
            }
            <div>Part {{part.id}}</div>
            <div style="clear: both;"></div>
          </div>
          <div class="partBody">
            @for(timeslot of part.timeslots; track timeslot.id; let isFirstTS = $first) {
              <app-tournament-day-timeslot-edit
                [timeslotStart]="timeslot.start"
                [timeslotStartReadOnly]="!isFirstTS || !isFirstPart"
                [slotType]="timeslot.slotType ? timeslot.slotType : _defaultSlotType"
                (onAddTimeSlotAfter)="addTimeSlotAfter(part.id, timeslot.id)"
                (onRemoveTimeSlot)="removeTimeSlot(part.id, timeslot.id)"
                (onSlotTypeChange)="onTimeslotTypeChange(part.id, timeslot.id, $event)"
                (onTimeSlotStartChange)="onTimeslotStartChange(part.id, timeslot.id, $event)">
              </app-tournament-day-timeslot-edit>
              }
          </div>
        </div>
      }
    </div>
    }
  </p-card>
  `,
  styles: [`
    .p-card-body{ padding-top: 0 !important;}
    .severalDayId{ margin-left: 25px; }
    .dayId { margin-top: 10px; margin-bottom: 10px; font-weight: bold; text-align: center; font-size: 1.5rem}
    .actions-day { margin-right: 10px; }
    .actions { float: right; }
    .action-add { font-size: 1rem; color: green; }
    .action-remove { font-size: 1rem; color: red; margin-left: 5px;}
    .dayHeader { /*width: 200px;*/  }
    .dayInfo { text-align: center; }
    .dayDateRow {}
    .dayOfWeek { text-align: center;}
    .dayDate {margin: 0 auto; width: 50% }
    .dayDateRO {text-align: center; margin-top: 20px; margin-bottom: 20px;}
    .partBlock { padding-bottom: 10px; margin-bottom: 10px; }
    .firstParts { border-bottom : 1px solid grey; }
    .partHeader { font-weight: bold; margin-bottom: 10px; }
    .partBody { }
  `],
  standalone: true
})
export class TournamentDayEditComponent {
  dateService = inject(DateService);
  cdr = inject(ChangeDetectorRef);
  timeslotService = inject(TimeslotService);

  day = model.required<Day>();
  dayOfWeek = computed<string>(() => this.dateService.toDayOfWeek(this.day().date));
  hasSeveralDays = input.required<boolean>()
  isFirstDay = input.required<boolean>();
  isLastDay = input.required<boolean>();
  dayDate: Date = new Date();
  onRemoveDay = output<void>();
  onDayChanged = output<void>();
  onDayDateChanged = output<void>();

  _defaultSlotType = defaultSlotType;

  constructor() {
    effect(() => {
      this.dayDate = this.dateService.epochToDate(this.day().date);
      // console.debug('effect ', this.day().id, this.dayOfWeek(), this.dayDate);
    });
  }

  onDateChange() {
    this.day.update((day) => {
      day.date = this.dateService.dateToEpoch(this.dayDate);
      // console.debug('onDateChange ', this.day().id, this.dayDate, this.dateService.toDate(day.date));
      this.onDayDateChanged.emit();
      return day;
    });
  }

  removeDay() { this.onRemoveDay.emit()}

  addPartAfter(partId: string) {
    this.day.update( day => {
      this.timeslotService.addPartAfter(day, partId);
      this.onDayChanged.emit();
      this.cdr.detectChanges();
      return day;
    });
  }
  removePart(partId: string) {
    this.day.update( day => {
      this.timeslotService.removePart(day, partId);
      this.onDayChanged.emit();
      return day;
    });
  }
  addTimeSlotAfter(partId: string, timeslotId: string) {
    this.day.update( day => {
      this.timeslotService.addTimeSlotAfter(day, partId, timeslotId);
      this.onDayChanged.emit();
      this.cdr.detectChanges();
      return day;
    });
  }
  removeTimeSlot(partId: string, timeslotId: string) {
    this.day.update( day => {
      this.timeslotService.removeTimeSlot(day, partId, timeslotId);
      this.onDayChanged.emit();
      return day;
    });
  }
  /**
   * The user has changed the type of the current timeslot.
   * Value is the new slot type.
   * Timeslot has been already updated (duration & end).
   */
  onTimeslotTypeChange(partId: string, timeslotId: string, slotType: SlotType) {
    this.day.update( day => {
      this.timeslotService.changeTimeSlotType(day, partId, timeslotId, slotType);
      this.onDayChanged.emit();
      return day;
    });

  }
  onTimeslotStartChange(partId: string, timeslotId: string, start: number) {
    this.day.update( day => {
      this.timeslotService.changeTimeslotStart(day, partId, timeslotId, start);
      this.onDayChanged.emit();
      return day;
    });
  }
}
