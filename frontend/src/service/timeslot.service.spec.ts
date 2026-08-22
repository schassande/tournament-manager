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

    expect(service.addPartAfter(day, '1')).toBeTrue();
    expect(service.addTimeSlotAfter(day, '1', originalId)).toBeTrue();

    const ids = day.parts.flatMap(part => part.timeslots.map(slot => slot.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(originalId).toBe(day.parts[0].timeslots[0].id);
    expect(ids.every(id => id.length > 20)).toBeTrue();
  });
});

function testDay(): Day {
  const start = 0;
  return {
    id: '1',
    date: 0,
    parts: [{
      id: '1',
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
