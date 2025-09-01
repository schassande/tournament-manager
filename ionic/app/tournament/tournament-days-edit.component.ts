import { DateService } from './../shared/services/date.service';
import { ChangeDetectorRef, Component, effect, inject, input, model, output, signal } from '@angular/core';
import { Day, Tournament } from 'src/app/shared/data.model';

@Component({
  selector: 'app-tournament-days-edit',
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
  <p-card class="addBlock" (click)="addDay()">
    <i class="pi pi-plus  action-add" aria-label="add day"></i>
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
    .dayBlock {
      width: '15rem';
    }
    .firstDays { }
  `],
  standalone: false
})
export class TournamentDaysEditComponent {
  tournament = model.required<Tournament>();
  days = signal<Day[]>([]);
  startDateChange = output<number>();
  endDateChange = output<number>();
  dayChange = output<void>();
  dateService = inject(DateService);

  cdr = inject(ChangeDetectorRef);

  constructor() {
    effect(() =>{
      this.days.set(this.tournament()!.days);
    })
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
              return { id: timeslot.id, start: timeslot.start, duration: timeslot.duration, end: timeslot.end, playingSlot: timeslot.playingSlot};
            }),
            allFieldsAvaillable: part.allFieldsAvaillable,
            availableFieldIds: part.availableFieldIds.map(id => id)
          }
        })
      });
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
