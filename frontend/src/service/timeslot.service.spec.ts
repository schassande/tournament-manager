import { TestBed } from '@angular/core/testing';
import { Day, defaultSlotType } from '@tournament-manager/persistent-data-model';

import { TimeslotService } from './timeslot.service';

describe('TimeslotService', () => {
  let service: TimeslotService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TimeslotService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('allocates opaque identifiers unique across all parts of a day', () => {
    const day = testDay();
    const originalId = day.parts[0].timeslots[0].id;

    expect(service.addPartAfter(day, '1', 'New part')).toBeTrue();
    expect(day.parts[1].name).toBe('New part');
    expect(service.addTimeSlotAfter(day, '1', originalId)).toBeTrue();

    const ids = day.parts.flatMap(part => part.timeslots.map(slot => slot.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(originalId).toBe(day.parts[0].timeslots[0].id);
    expect(ids.every(id => id.length > 20)).toBeTrue();
  });

  it('splits a part without changing timeslot IDs or values', () => {
    const day = testDayWithParts();
    const originalSlots = day.parts[0].timeslots.map(slot => ({ ...slot }));

    expect(service.splitPart(day, 'first', 'slot-2', 'Split part')).toBeTrue();

    expect(day.parts.length).toBe(3);
    expect(day.parts[0].id).toBe('first');
    expect(day.parts[1].id).not.toBe('second');
    expect(day.parts[1].name).toBe('Split part');
    expect(day.parts[0].timeslots.map(slot => slot.id)).toEqual(['slot-1', 'slot-2']);
    expect(day.parts[1].timeslots.map(slot => slot.id)).toEqual(['slot-3']);
    expect(day.parts[0].timeslots.concat(day.parts[1].timeslots)).toEqual(originalSlots);
    expect(day.parts[1].allFieldsAvaillable).toBeTrue();
    expect(day.parts[1].availableFieldIds).toEqual([]);
  });

  it('merges a part into its predecessor without renumbering parts', () => {
    const day = testDayWithParts();

    expect(service.mergePartWithPrevious(day, 'second')).toBeTrue();

    expect(day.parts.map(part => part.id)).toEqual(['first']);
    expect(day.parts[0].timeslots.map(slot => slot.id)).toEqual(['slot-1', 'slot-2', 'slot-3', 'slot-4']);
    expect(day.parts[0].allFieldsAvaillable).toBeTrue();
    expect(day.parts[0].availableFieldIds).toEqual([]);
  });

  it('moves the boundary in both directions while preserving slot values', () => {
    const day = testDayWithParts();
    const slot2 = { ...day.parts[0].timeslots[1] };
    const slot3 = { ...day.parts[0].timeslots[2] };
    const slot4 = { ...day.parts[1].timeslots[0] };

    expect(service.moveBoundaryUp(day, 'second')).toBeTrue();
    expect(day.parts[0].timeslots.map(slot => slot.id)).toEqual(['slot-1', 'slot-2']);
    expect(day.parts[1].timeslots.map(slot => slot.id)).toEqual(['slot-3', 'slot-4']);
    expect(day.parts[1].timeslots[0]).toEqual(slot3);

    expect(service.moveBoundaryDown(day, 'second')).toBeTrue();
    expect(day.parts[0].timeslots.map(slot => slot.id)).toEqual(['slot-1', 'slot-2', 'slot-3']);
    expect(day.parts[1].timeslots.map(slot => slot.id)).toEqual(['slot-4']);
    expect(day.parts[0].timeslots[1]).toEqual(slot2);
    expect(day.parts[0].timeslots[2]).toEqual(slot3);
    expect(day.parts[1].timeslots[0]).toEqual(slot4);
  });

  it('rejects invalid split and boundary operations', () => {
    const day = testDayWithParts();

    expect(service.splitPart(day, 'first', 'slot-4', 'Invalid split')).toBeFalse();
    expect(service.mergePartWithPrevious(day, 'first')).toBeFalse();
    expect(service.moveBoundaryUp(day, 'first')).toBeFalse();
    expect(service.moveBoundaryDown(day, 'first')).toBeFalse();
  });
});

function testDay(): Day {
  const start = 0;
  return {
    id: '1',
    date: 0,
    parts: [{
      id: '1',
      name: '1',
      dayId: '1',
      timeslots: [{
        id: crypto.randomUUID(),
        start,
        duration: 50,
        end: 50,
        slotType: defaultSlotType,
        playingSlot: true,
      }],
      allFieldsAvaillable: true,
      availableFieldIds: [],
    }],
  };
}

function testDayWithParts(): Day {
  return {
    id: 'day-1',
    date: 0,
    parts: [
      {
        id: 'first',
        name: 'First part',
        dayId: 'day-1',
        timeslots: [testTimeslot('slot-1', 0), testTimeslot('slot-2', 50), testTimeslot('slot-3', 100)],
        allFieldsAvaillable: true,
        availableFieldIds: [],
      },
      {
        id: 'second',
        name: 'Second part',
        dayId: 'day-1',
        timeslots: [testTimeslot('slot-4', 150)],
        allFieldsAvaillable: false,
        availableFieldIds: ['field-1'],
      },
    ],
  };
}

function testTimeslot(id: string, start: number) {
  return {
    id,
    start,
    duration: 50,
    end: start + 50,
    slotType: defaultSlotType,
    playingSlot: true,
  };
}
