import { TimeslotToolbooxComponent } from './timeslot-toolbox.component';
import { Day, PartDay, Timeslot, Tournament } from '@tournament-manager/persistent-data-model';
import { DateService } from '../service/date.service';
import { ChangeDetectorRef, Component, effect, inject, model, output, signal } from '@angular/core';
import { TournamentDayEditComponent } from '../component/tournament-day-edit.component';
import { CardModule } from 'primeng/card';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';

@Component({
  selector: 'app-tournament-days-edit',
  imports: [CardModule, CommonModule, DatePickerModule, FormsModule, TimeslotToolbooxComponent, TournamentDayEditComponent],
  template: `
  @for(day of days(); let idx = $index; let isLastDay = $last ; let isFirstDay = $first ; track day.id) {
    <app-tournament-day-edit
      [day]="day"
      [hasSeveralDays]="tournament().days.length > 1"
      [isFirstDay]="isFirstDay"
      [isLastDay]="isLastDay"
      (onAddDay)="addDay()"
      (onRemoveDay)="removeDay()"
      (onDayChanged)="onDayChanged(day)"
      (onDayDateChanged)="onStartDateChange()"
      class="dayBlock" [ngClass]="{ firstDays: !isLastDay}"
      >
    </app-tournament-day-edit>
  }
  <p-card class="addBlock">
    <div class="action">
      <i class="pi pi-plus" aria-label="Add a day" title="Add a day" (click)="addDay()"></i>
    </div>
  </p-card>
  <p-card class="addBlock">
    <div class="action">
      <i class="pi pi-stopwatch" aria-label="Set timeslot type to all" title="Set timeslot type to all" (click)="toggleToolboxVisibility()"></i>
      @if (timeslotToolboxVisibility()) {
        <span style="margin-left: 10px; font-weight: bold;">Slot type toolbox</span>
        <div style="height: 20px;"></div>
        <app-timeslot-toolbox
          [tournament]="tournament()"
          [days]="days()"
          (onDayTimeSlotTypeChange)="onDayTimeSlotTypeChange($event)"></app-timeslot-toolbox>
      }
    </div>
  </p-card>
`,
  styles: [`
    .addBlock,
    .dayBlock {
      display: inline-block;
      vertical-align: top;
      padding: 5px;
      margin: 5px;
    }
    .addBlock { background-color: #ffffff}
    .dayBlock {
      width: '15rem';
    }
    .firstDays { }
    .action {
      cursor: pointer;
    }
  `],
  standalone: true
})
export class TournamentDaysEditComponent {
  tournament = model.required<Tournament>();
  days = signal<Day[]>([]);
  startDateChange = output<number>();
  endDateChange = output<number>();
  dayChange = output<void>();
  dateService = inject(DateService);

  cdr = inject(ChangeDetectorRef);
  timeslotToolboxVisibility = signal<boolean>(false);

  constructor() {
    effect(() =>{
      this.days.set(this.tournament()!.days);
    })
  }
  toggleToolboxVisibility() {
    this.timeslotToolboxVisibility.set(!this.timeslotToolboxVisibility());
  }
  onDayTimeSlotTypeChange(updatedDays: Day[]) {
    this.days.update(days => {
      this.dayChange.emit();
      return days;
    });

  }
  onStartDateChange() {
    this.days.update((days) => {
      //adjust the first day and the next
      // console.log('onStartDateChange', this.dateService.toDate(days[0].date));
      for (let i = 1; i < days.length; i++) {
        days[i].date = this.dateService.addDay(days[i-1].date, 1);
        console.log('onStartDateChange: set day date', days[i].id, 'to', this.dateService.toDate(days[i].date));
      }
      this.startDateChange.emit(days[0].date);
      this.endDateChange.emit(days[days.length-1].date);
      this.tournament.update(t => { t.days = days; return t; })
      console.debug('Reset days')
      setTimeout(() =>{
        console.debug('Set days')
        this.days.set(this.tournament().days);
      }, 50);
        return [];
    });

  }
  onDayChanged(day: Day) {
    this.days.update((days) => {
      this.cdr.detectChanges();
      this.dayChange.emit();
      return days;
    });
  }
  addDay() {
    this.days.update(days => {
      // add a new day after the last.
      const lastDay = days[days.length - 1];

      // The date of the new is the day after of the last day. use daysjs
      const newDate = this.dateService.addDay(lastDay.date, 1);

      // Duplicate the parts of the previous day.
      days.push({
        id: (days.length + 1).toString(),
        date: newDate,
        parts: lastDay.parts.map(part => {
          return {
            id: part.id,
            dayId: part.dayId,
            timeslots: part.timeslots.map(timeslot => {
              return {
                id: timeslot.id,
                start: timeslot.start,
                duration: timeslot.duration,
                end: timeslot.end,
                playingSlot: timeslot.playingSlot,
                slotType: timeslot.slotType,
              } as Timeslot;
            }),
            allFieldsAvaillable: part.allFieldsAvaillable,
            availableFieldIds: part.availableFieldIds.map(id => id)
          } as PartDay;
        })
      } as Day);
      this.endDateChange.emit(days[days.length-1].date);
      this.cdr.detectChanges();
      return days;
    });
  }
  removeDay() {
    this.days.update(days => {
      if (days.length <= 1) {
        return days;
      }
      days.pop();
      this.endDateChange.emit(days[days.length-1].date);
      return days;
    });
  }
}
