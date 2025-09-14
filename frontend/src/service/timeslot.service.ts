import { inject, Injectable } from '@angular/core';
import { Day, defaultSlotType, PartDay, SlotType, Timeslot } from '@tournament-manager/persistent-data-model';
import { DateService } from './date.service';

@Injectable({
  providedIn: 'root'
})
export class TimeslotService {
  dateService = inject(DateService);

  public addPartAfter(day: Day, partId: string): boolean {
    // find the position where to insert the new PartDay
    const partIdx = day.parts.findIndex(p => partId === p.id);
    if (partIdx < 0) return false;
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
        end: this.dateService.addMilli(lastTimeslot.end, lastTimeslot.duration),
        playingSlot: lastTimeslot.playingSlot,
        slotType: lastTimeslot.slotType,
      }],
      allFieldsAvaillable: part.allFieldsAvaillable,
      availableFieldIds: part.availableFieldIds.map(f => f)
    };
    day.parts.splice(partIdx + 1, 0, newPart);
    this.removeTimeSlotsOutOfDay(day);
    this.renameParts(day);
    this.adjustNextPart(day, partIdx)
    return true;
  }
  public removePart(day: Day, partId: string): boolean {
    if (day.parts.length <= 1) return false;

    const partIdx = day.parts.findIndex(p => partId === p.id);
    if (partIdx <= 0) return false; // part not found => can't remove
    // remove the part
    day.parts.splice(partIdx, 1);
    this.renameParts(day);
    this.adjustNextPart(day, partIdx)
    return true;
  }
  public addTimeSlotAfter(day: Day, partId: string, timeslotId: string): boolean {
    // search the timeslot in the part
    const partIdx = day.parts.findIndex(p => partId === p.id);
    if (partIdx < 0) return false; // part not found => can't add
    const part = day.parts[partIdx];
    const tsIdx = part.timeslots.findIndex(ts => ts.id === timeslotId);
    if (tsIdx < 0) return false; // timeslot not found => can't add
    const timeslot = part.timeslots[tsIdx];

    // insert a new timeslot after the current timeslot
    const newTimeslot: Timeslot = { id: '1',
      start: timeslot.end,
      duration: timeslot.duration, end:
      this.dateService.addMilli(timeslot.end, timeslot.duration),
      playingSlot: timeslot.playingSlot,
      slotType: timeslot.slotType
    };
    part.timeslots.splice(tsIdx + 1, 0, newTimeslot);

    this.adjustNextTimeSlot(part, tsIdx);
    this.adjustNextPart(day, partIdx)
    this.renameTimeslots(part);
    this.removeTimeSlotsOutOfDay(day);
    return true;
  }
  public removeTimeSlot(day: Day, partId: string, timeslotId: string): boolean {
    const partIdx = day.parts.findIndex(p => p.id === partId);
    if (partIdx < 0) return false;
    const part = day.parts[partIdx];
    if (part.timeslots.length < 2) return false;
    const tsIdx = part.timeslots.findIndex(ts => ts.id === timeslotId);
    if (tsIdx < 0) return false;

    part.timeslots.splice(tsIdx, 1);
    this.renameTimeslots(part);
    this.adjustNextPart(day, partIdx)
    return true;
  }

  public changeTimeslotStart(day: Day, partId: string, timeslotId: string, start: number): boolean {
    const partIdx = day.parts.findIndex(p => p.id === partId);
    if (partIdx < 0) return false;
    const part = day.parts[partIdx];
    const tsIdx = part.timeslots.findIndex(ts => ts.id === timeslotId);
    if (tsIdx < 0) return false; // timeslot not found => can't add
    const ts = part.timeslots[tsIdx];
    ts.start = start;
    ts.end = this.dateService.addMilli(ts.start, ts.duration);
    console.debug('onTimeslotStartChange('+partId+','+timeslotId+','+start+')', this.dateService.toTime(ts.start), this.dateService.toTime(ts.end));

    this.adjustNextTimeSlot(part, tsIdx);
    this.adjustNextPart(day, partIdx)

    this.removeTimeSlotsOutOfDay(day);
    return true;
  }

  public changeTimeSlotType(day: Day, partId: string, timeslotId: string, newSlotType: SlotType): boolean {
    // console.debug('onTimeslotTypeChange begin', partId, timeslotId, newSlotType);
    const partIdx = day.parts.findIndex(p => p.id === partId);
    if (partIdx < 0) return false;
    const part = day.parts[partIdx];
    const tsIdx = part.timeslots.findIndex(ts => ts.id === timeslotId);
    if (tsIdx < 0) return false;
    const ts = part.timeslots[tsIdx];

    // console.debug('changeTimeSlotType ts', JSON.stringify(ts));
    ts.slotType = newSlotType;
    ts.duration = newSlotType.totalDuration * 60 * 1000;
    ts.playingSlot = newSlotType.playTime > 0;
    ts.end = this.dateService.addMilli(ts.start, ts.duration);
    // console.debug('changeTimeSlotType end ts', JSON.stringify(ts));

    this.adjustNextTimeSlot(part, tsIdx);
    this.adjustNextPart(day, partIdx)

    this.removeTimeSlotsOutOfDay(day);
    return true;
  }

  /**
   * the next timeslot starts before the end of the new time slot
   * => shift start and end of the next timeslots
   */
  public adjustNextTimeSlot(part: PartDay, timeSlotIdx:number) {
    for (let i = timeSlotIdx + 1; i < part.timeslots.length; i++) {
      // console.debug('adjustNextTimeSlot compare', part.timeslots[i-1], part.timeslots[i])
      if (part.timeslots[i].start != part.timeslots[i-1].end) {
        part.timeslots[i].start = part.timeslots[i-1].end;
        part.timeslots[i].end = this.dateService.addMilli(part.timeslots[i].start, part.timeslots[i].duration);
        console.debug('adjust TS id='+part.timeslots[i].id+', start='+this.dateService.toTime(part.timeslots[i].start)+', end='+this.dateService.toTime(part.timeslots[i].end))
      }
    }
  }
  public adjustNextPart(day: Day, partIdx:number) {
    const part = day.parts[partIdx];
    let lastEnd = part.timeslots[part.timeslots.length-1].end;;
    for(let nextPartIdx = partIdx + 1; nextPartIdx < day.parts.length; nextPartIdx++) {
      // adjust the start of the next timeslot of next parts
      const nextPart = day.parts[nextPartIdx];
      console.debug('adjustNextPart('+part.id+'): next Part', nextPart.id, 'lastEnd=', this.dateService.toTime(lastEnd));
      if (nextPart.timeslots.length > 0) {
        nextPart.timeslots[0].start = lastEnd;
        nextPart.timeslots[0].end = this.dateService.addMilli(nextPart.timeslots[0].start, nextPart.timeslots[0].duration);
        console.debug('adjustNextPart('+part.id+'): next Part', nextPart.id, 'ts[0].end=', nextPart.timeslots[0].end);
        this.adjustNextTimeSlot(nextPart, 0);
        lastEnd = nextPart.timeslots[nextPart.timeslots.length-1].end;;
      } // else no timeslot in next part => nothing to adjust
    }
  }

  /**  rename id of all timeslots in order to be sure the names are ordered correctly */
  public renameTimeslots(part: PartDay) {
    for (let i = 0; i < part.timeslots.length; i++) {
      part.timeslots[i].id = (i + 1).toString();
    }
  }
  public removeTimeSlotsOutOfDay(day: Day) {
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
          end: this.dateService.addMilli(defaultTimeSlotStart, defaultDuration),
          slotType: defaultSlotType,
          playingSlot: defaultSlotType.playTime > 0,
        }],
        allFieldsAvaillable: true,
        availableFieldIds: []
      });
    }
  }
  /**  rename id of all parts in order to be sure the names are ordered correctly */
  public renameParts(day: Day) {
    for (let i = 0; i < day.parts.length; i++) {
      day.parts[i].id = (i + 1).toString();
    }
  }
}
