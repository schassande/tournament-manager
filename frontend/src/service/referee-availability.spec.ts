import {
  Day,
  PartDayUnavailability,
  defaultSlotType,
  normalizePartDayUnavailabilities,
} from '@tournament-manager/persistent-data-model';

describe('referee availability normalization', () => {
  const days: Day[] = [{
    id: 'day-1',
    date: 0,
    parts: [{
      id: 'part-1',
      name: 'part-1',
      dayId: 'day-1',
      timeslots: [
        slot('slot-1'),
        slot('slot-2'),
      ],
      allFieldsAvaillable: true,
      availableFieldIds: [],
    }],
  }];

  it('removes invalid references and omits fully available entries', () => {
    const entries: PartDayUnavailability[] = [{
      dayId: 'missing-day',
      unavailability: 'PARTIAL',
      unavailableSlotIds: ['slot-1'],
    }, {
      dayId: 'day-1',
      unavailability: 'PARTIAL',
      unavailableSlotIds: ['missing-slot'],
    }];

    expect(normalizePartDayUnavailabilities(days, entries)).toBeUndefined();
  });

  it('converts a partial entry covering all remaining slots to TOTAL', () => {
    const entries: PartDayUnavailability[] = [{
      dayId: 'day-1',
      unavailability: 'PARTIAL',
      unavailableSlotIds: ['slot-1', 'missing-slot', 'slot-2'],
    }];

    expect(normalizePartDayUnavailabilities(days, entries)).toEqual([{
      dayId: 'day-1',
      unavailability: 'TOTAL',
      unavailableSlotIds: [],
    }]);
  });

  it('gives TOTAL priority when duplicate entries conflict', () => {
    const entries: PartDayUnavailability[] = [{
      dayId: 'day-1',
      unavailability: 'PARTIAL',
      unavailableSlotIds: ['slot-1'],
    }, {
      dayId: 'day-1',
      unavailability: 'TOTAL',
      unavailableSlotIds: ['slot-2'],
    }];

    expect(normalizePartDayUnavailabilities(days, entries)).toEqual([{
      dayId: 'day-1',
      unavailability: 'TOTAL',
      unavailableSlotIds: [],
    }]);
  });
});

function slot(id: string) {
  return {
    id,
    start: 0,
    duration: 1,
    end: 1,
    slotType: defaultSlotType,
    playingSlot: true,
  };
}
