import { UserService } from './../shared/services/user.service';
import { ChangeDetectorRef, Component, computed, effect, inject, Input, input, model, OnInit, output, signal } from '@angular/core';
import { DateService } from '../shared/services/date.service';
import { Day, PartDay, Timeslot } from '../shared/data.model';

@Component({
  selector: 'app-tournament-day-edit',
  template: `
  <p-card class="dayCard">
    <ng-template #header>
      <div class="dayId" [ngClass]="{ severalDayId : isLastDay() && hasSeveralDays() }">
        <span>Day {{day().id}}</span>
        <div class="actions actions-day" *ngIf="isLastDay() && hasSeveralDays()">
          <i class="pi pi-trash  action-remove" aria-label="remove day"  (click)="removeDay()"></i>
        </div>
      </div>
      <div class="dayDate">
        <ion-input type="date" [(ngModel)]="dayDateStr"  required="true"
          (ionChange)="onDateChange()"
          [readonly]="!isFirstDay()" style="text-align: center;"></ion-input>
      </div>
      <div class="dayOfWeek">{{dateService.toDayOfWeek(day().date)}}</div>
      <div style="clear: both;"></div>
    </ng-template>
    <div class="dayBody" *ngIf="day()">
      @for(part of day().parts; let isLastPart = $last; track part.id) {
        <div class="partBlock" [ngClass]="{ firstParts : !isLastPart && day().parts.length > 1 }">
          <div class="partHeader">
            <div class="actions" *ngIf="isLastPart">
              <i class="pi pi-plus action-add"     aria-label="add part"     (click)="addPartAfter(part.id)"></i>
              <i class="pi pi-trash action-remove" aria-label="remove part"  (click)="removePart(part.id)" *ngIf="day().parts.length > 1"></i>
            </div>
            <div>Part {{part.id}}</div>
            <div style="clear: both;"></div>
          </div>
          <div class="partBody">
            @for(timeslot of part.timeslots; track timeslot.id) {
              <app-tournament-day-timeslot-edit
                [timeslotId]="timeslot.id"
                [timeslotDuration]="timeslot.duration"
                [timeslotStart]="timeslot.start"
                (onAddTimeSlotAfter)="addTimeSlotAfter(part.id, timeslot.id)"
                (onRemoveTimeSlot)="removeTimeSlot(part.id, timeslot.id)"
                (onDuractionChange)="onTimeslotDurationChange(part.id, timeslot.id, $event)"
                (onTimeSlotStartChange)="onTimeslotStartChange(part.id, timeslot.id, $event)">
              </app-tournament-day-timeslot-edit>
              }
          </div>
        </div>
      }
    </div>
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
  standalone: false
})
export class TournamentDayEditComponent {
  dateService = inject(DateService);
  cdr = inject(ChangeDetectorRef);

  day = model.required<Day>();
  hasSeveralDays = input.required<boolean>()
  isFirstDay = input.required<boolean>();
  isLastDay = input.required<boolean>();
  dayDateStr = '31/12/2020';
  onRemoveDay = output<void>();
  onDayChanged = output<void>();
  onDayDateChanged = output<void>();

  constructor() {
    effect(() => {
      const dateEpoch = this.day().date;
      this.dayDateStr = this.dateService.toDateStr(dateEpoch, 'YYYY-MM-DD');
      this.cdr.detectChanges();
      //console.debug('effect ', this.day().id, this.dayDateStr);
    });
  }

  onDateChange() {
    this.day.update((day) => {
      day.date = this.dateService.fromDateStr(this.dayDateStr, 'YYYY-MM-DD');
      // console.debug('onDateChange ', this.day().id, this.dayDateStr, this.dateService.toDate(day.date));
      this.onDayDateChanged.emit();
      return day;
    });
  }


  removeDay() { this.onRemoveDay.emit()}

  addPartAfter(partId: string) {
    this.day.update( day => {
      // find the position where to insert the new PartDay
      const partIdx = day.parts.findIndex(p => partId === p.id);
      if (partIdx < 0) return day;
      const part = day.parts[partIdx];
      // get the last slot of the part
      const lastTimeslot = part.timeslots[part.timeslots.length - 1];
      // insert a new PartDay with one time slot starting after the last time slot of the previous PartDay
      const newPart: PartDay = {
        id: (day.parts.length + 1).toString(),
        dayId: day.id,
        timeslots : [{
          id: '1',
          start: lastTimeslot.end,
          duration: lastTimeslot.duration,
          end: this.dateService.addMilli(lastTimeslot.end, lastTimeslot.duration)
        }],
        allFieldsAvaillable: part.allFieldsAvaillable,
        availableFieldIds: part.availableFieldIds.map(f => f)
      };
      day.parts.splice(partIdx + 1, 0, newPart);
      this.removeTimeSlotsOutOfDay(day);
      this.renameParts(day);
      this.onDayChanged.emit();
      this.cdr.detectChanges();
      return day;
    });
  }
  removePart(partId: string) {
    this.day.update( day => {
      if (day.parts.length <= 1) return day;

      const partIdx = day.parts.findIndex(p => partId === p.id);
      if (partIdx <= 0) return day; // part not found => can't remove
      // remove the part
      day.parts.splice(partIdx, 1);
      this.renameParts(day);
      this.onDayChanged.emit();
      return day;
    });
  }
  addTimeSlotAfter(partId: string, timeslotId: string) {
    this.day.update( day => {
      // search the timeslot in the part
      const partIdx = day.parts.findIndex(p => partId === p.id);
      if (partIdx < 0) return day; // part not found => can't add
      const part = day.parts[partIdx];
      const tsIdx = part.timeslots.findIndex(ts => ts.id === timeslotId);
      if (tsIdx < 0) return day; // timeslot not found => can't add
      const timeslot = part.timeslots[tsIdx];

      // insert a new timeslot after the current timeslot
      const newTimeslot: Timeslot = { id: '1',
        start: timeslot.end,
        duration: timeslot.duration, end:
        this.dateService.addMilli(timeslot.end, timeslot.duration)
      };
      part.timeslots.splice(tsIdx + 1, 0, newTimeslot);

      this.adjustNextTimeSlot(part, tsIdx);
      this.renameTimeslots(part);
      this.removeTimeSlotsOutOfDay(day);
      this.onDayChanged.emit();
      this.cdr.detectChanges();
      return day;
    });
  }
  removeTimeSlot(partId: string, timeslotId: string) {
    this.day.update( day => {
      const partIdx = day.parts.findIndex(p => p.id === partId);
      if (partIdx < 0) return day;
      const part = day.parts[partIdx];
      if (part.timeslots.length < 2) return day;
      const tsIdx = part.timeslots.findIndex(ts => ts.id === timeslotId);
      if (tsIdx < 0) return day;

      part.timeslots.splice(tsIdx, 1);
      this.renameTimeslots(part);
      this.onDayChanged.emit();
      return day;
    });
  }
  onTimeslotDurationChange(partId: string, timeslotId: string, duration: number) {
    this.day.update( day => {
      console.debug('onTimeslotDurationChange begin', timeslotId, duration)
      const partIdx = day.parts.findIndex(p => p.id === partId);
      if (partIdx < 0) return day;
      const part = day.parts[partIdx];
      const tsIdx = part.timeslots.findIndex(ts => ts.id === timeslotId);
      if (tsIdx < 0) return day;
      const ts = part.timeslots[tsIdx];

      ts.duration = duration;
      ts.end = this.dateService.addMilli(ts.start, ts.duration);
      this.adjustNextTimeSlot(part, tsIdx);
      this.removeTimeSlotsOutOfDay(day);
      this.onDayChanged.emit();
      return day;
    });
  }
  onTimeslotStartChange(partId: string, timeslotId: string, start: number) {
    this.day.update( day => {
      const partIdx = day.parts.findIndex(p => p.id === partId);
      if (partIdx < 0) return day;
      const part = day.parts[partIdx];
      const tsIdx = part.timeslots.findIndex(ts => ts.id === timeslotId);
      if (tsIdx < 0) return day; // timeslot not found => can't add
      const ts = part.timeslots[tsIdx];
      ts.start = start;
      ts.end = this.dateService.addMilli(ts.start, ts.duration);
      // console.debug('onTimeslotStartChange('+partId+','+timeslotId+','+start+')', this.dateService.toTime(ts.start), this.dateService.toTime(ts.end));
      this.adjustNextTimeSlot(part, tsIdx);
      this.removeTimeSlotsOutOfDay(day);
      this.onDayChanged.emit();
      return day;
    });
  }

  /**  rename id of all parts in order to be sure the names are ordered correctly */
  private renameParts(day: Day) {
    for (let i = 0; i < day.parts.length; i++) {
      day.parts[i].id = (i + 1).toString();
    }
  }
  /**
   * the next timeslot starts before the end of the new time slot
   * => shift start and end of the next timeslots
   */
  private adjustNextTimeSlot(part: PartDay, timeSlotIdx:number) {
    for (let i = timeSlotIdx + 1; i < part.timeslots.length; i++) {
      // console.debug('adjustNextTimeSlot compare', part.timeslots[i-1], part.timeslots[i])
      if (part.timeslots[i].start < part.timeslots[i-1].end) {
        part.timeslots[i].start = part.timeslots[i-1].end;
        part.timeslots[i].end = this.dateService.addMilli(part.timeslots[i].start, part.timeslots[i].duration);
        console.debug('adjust TS id='+part.timeslots[i].id+', start='+this.dateService.toTime(part.timeslots[i].start)+', end='+this.dateService.toTime(part.timeslots[i].end))
      }
    }
  }
  /**  rename id of all timeslots in order to be sure the names are ordered correctly */
  private renameTimeslots(part: PartDay) {
    for (let i = 0; i < part.timeslots.length; i++) {
      part.timeslots[i].id = (i + 1).toString();
    }
  }
  private removeTimeSlotsOutOfDay(day: Day) {
    // remove all timeslots that are out of the day
    const dayStart = this.dateService.to00h00(day.date);
    const dayEnd = this.dateService.addDay(dayStart , 1);
    day.parts.forEach(part => {
      part.timeslots = part.timeslots.filter(timeslot => {
        const keep = timeslot.start < dayEnd;
        if (!keep) console.debug('Timeslot removed removed because out of the day ', timeslot)
        return keep;
      });
    });

    // remove the parts without timeslot
    day.parts = day.parts.filter(part => {
      const keep = part.timeslots.length > 0;
      if (!keep) console.debug('Part removed removed because no timeslot ', part)
      return keep;
    });
    if (day.parts.length === 0) {
      const defaultTimeSlotStart = this.dateService.setTime(day.date, 9,0);
      const defaultDuration = 50 * 60 * 1000;
      day.parts.push({
        id: '1',
        dayId: day.id,
        timeslots : [{
          id: '1',
          start: defaultTimeSlotStart,
          duration: defaultDuration,
          end: this.dateService.addMilli(defaultTimeSlotStart, defaultDuration)
        }],
        allFieldsAvaillable: true,
        availableFieldIds: []
      });
    }
  }
}
