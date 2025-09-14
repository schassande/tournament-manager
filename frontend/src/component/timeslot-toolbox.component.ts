import { TimeslotService } from './../service/timeslot.service';
import { Day, defaultSlotType, defaultSloTypes, newSlotType, SlotType, Tournament } from '@tournament-manager/persistent-data-model';
import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Select } from "primeng/select";
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-timeslot-toolbox',
  imports: [ButtonModule, CommonModule, FormsModule, Select],
  template: `
  <div>
    <div>
      <label>Replace time slot type: </label>
      <p-select inputId="sourceTimeslotType" [options]="sourceSlotTypes" optionLabel="name" [filter]=true
        [(ngModel)]="sourceSlotType">
      </p-select>
    </div>
    <div>
      <label>By time slot type: </label>
      <p-select inputId="destinationTimeslotType" [options]="destinationSlotTypes" optionLabel="name" [filter]=true
        [(ngModel)]="destinationSlotType">
      </p-select>
    </div>
    <div>
      <label>Apply to: </label>
      <p-select inputId="destinationDay" [options]="destinationDays()" optionLabel="name" [filter]=true
        [(ngModel)]="destinationDay">
      </p-select>
    </div>
    <div style="text-align: right; margin-top: 10px;">
      <p-button label="Apply" (click)="applyAction()"></p-button>
    </div>
  </div>`,
  styles: [`
  `],
  standalone: true
})
export class TimeslotToolbooxComponent {

  readonly allSlot = newSlotType('All slots', 0, 0, 0, 0, 0);
  readonly allPlaySlot = newSlotType('All playing slots', 0, 0, 0, 0, 0);
  readonly allBreakSlot = newSlotType('All break slots', 0, 0, 0, 0, 0);

  timeslotService = inject(TimeslotService);

  sourceSlotType = signal<SlotType>(this.allSlot);
  destinationSlotType = signal<SlotType>(defaultSlotType);
  tournament = model.required<Tournament>();
  days = model.required<Day[]>();

  onDayTimeSlotTypeChange = output<Day[]>();
  sourceSlotTypes = [ this.allSlot, this.allPlaySlot, this.allBreakSlot ].concat(defaultSloTypes);
  destinationSlotTypes = defaultSloTypes;
  destinationDays = computed<DestinationDay[]>(() => {
    const dds: DestinationDay[] = [defaultDestinationDay];
    for (let day of this.tournament()!.days) {
      dds.push({ name: 'Day ' + day.id, id: day.id+'-all' });
      if (day.parts.length > 1) {
        for (let part of day.parts) {
          dds.push({ name: 'Day ' + day.id + ' - Part ' + part.id, id: day.id+'-'+part.id });
        }
      }
    }
    return dds;
  })
  destinationDay = signal<DestinationDay>(defaultDestinationDay)

  constructor() {
    effect(() =>{
      this.days.set(this.tournament()!.days);
    })
  }

  applyAction() {
    const source = this.sourceSlotType();
    const destination = this.destinationSlotType();
    const destinationDay = this.destinationDay();
    if (!source || !destination || !destinationDay) { return; }
    if (source.id === destination.id) { return; }
    console.log('Apply timeslot type change: ', source, ' to ', destination, ' for ', destinationDay);
    const daysToUpdate: Day[] = [];
    const [dayId, partId] = destinationDay.id.split('-');
    this.days.update(days => {
      for (let day of days) {
        if (dayId === 'all' || day.id === dayId) {
          let dayUpdated = false;
          for (let part of day.parts) {
            if (partId === 'all' || part.id === partId) {
              for (let slot of part.timeslots) {
                if (slot.slotType.id === source.id
                  || (this.allSlot.id === source.id)
                  || (this.allPlaySlot.id === source.id && slot.slotType.playTime > 0)
                  || (this.allBreakSlot.id === source.id && slot.slotType.playTime === 0)
                  ) {
                  if (slot.slotType.id === destination.id) {
                    console.log(' - Unchanged slot ', slot.id, ' type ', slot.slotType.id);
                  } else {
                    console.log(' - Update slot ', slot.id, ' from ', slot.slotType.id, ' to ', destination.id);
                    this.timeslotService.changeTimeSlotType(day, part.id, slot.id, destination);
                    dayUpdated = true;
                  }
                }
              }
            }
          }
          if (dayUpdated) daysToUpdate.push(day);
        }
      }
      if (daysToUpdate.length > 0) {
        console.log('Days updated: ', daysToUpdate);
        this.onDayTimeSlotTypeChange.emit(daysToUpdate);
      }
      return days;
    });
  }
}
interface DestinationDay {
  name: string;
  id: string;
}
const  defaultDestinationDay: DestinationDay = { id: 'all-all', name: 'All days - All parts' };
