import { GameView } from '../allocation-data-model';
import {
  buildAllocationProblems,
  defaultAllocationConfiguration,
  isCoachEligible,
} from './allocation-problem.service';

describe('allocation problem service', () => {
  it('rejects an unavailable coach', () => {
    const coach = testCoach('coach-1', [{ dayId: 'day-1', unavailability: 'PARTIAL', unavailableSlotIds: ['slot-2'] }]);
    const target = testGame('game-2', 'slot-2', 50, [], []);

    expect(isCoachEligible(coach, target, [], defaultAllocationConfiguration()).reasons)
      .toContain('coach-unavailable');
  });

  it('allows one coach on two fields when configured', () => {
    const coach = testCoach('coach-1');
    const assigned = testGame('game-1', 'slot-1', 50, [{ attendeeId: coach.attendee.id }], []);
    const target = testGame('game-2', 'slot-1', 50, [], []);
    const configuration = { ...defaultAllocationConfiguration(), refereeCoachTwoField: true };

    expect(isCoachEligible(coach, target, [assigned], configuration).eligible).toBeTrue();
  });

  it('reports both locations for a referee same-timeslot conflict', () => {
    const referee = testReferee('referee-1');
    const games = [
      testGame('game-1', 'slot-1', 50, [], [{ attendeeId: referee.attendee.id }]),
      testGame('game-2', 'slot-1', 50, [], [{ attendeeId: referee.attendee.id }]),
    ];

    const problems = buildAllocationProblems(games, [referee], [], defaultAllocationConfiguration());
    const sameSlot = problems.find(problem => problem.kind === 'referee-same-timeslot');

    expect(sameSlot?.locations.map(location => location.gameId)).toEqual(['game-1', 'game-2']);
  });

  it('reports all assignments contributing to a coach consecutive-time violation', () => {
    const coach = testCoach('coach-1');
    const games = [
      testGame('game-1', 'slot-1', 100, [{ attendeeId: coach.attendee.id }], []),
      testGame('game-2', 'slot-2', 100, [{ attendeeId: coach.attendee.id }], []),
    ];

    const problems = buildAllocationProblems(games, [], [coach], defaultAllocationConfiguration());
    const consecutive = problems.find(problem => problem.kind === 'coach-consecutive-time');

    expect(consecutive?.locations.map(location => location.gameId)).toEqual(['game-1', 'game-2']);
  });
});

function testCoach(id: string, unavailabilities?: unknown[]): any {
  return { attendee: { id, unavailabilities } };
}

function testReferee(id: string): any {
  return { attendee: { id, unavailabilities: [] } };
}

function testGame(
  id: string,
  timeslotId: string,
  playTime: number,
  coaches: { attendeeId: string }[],
  referees: { attendeeId: string }[],
): GameView {
  const timeslot = {
    id: timeslotId,
    start: timeslotId === 'slot-2' ? 100 : 0,
    end: timeslotId === 'slot-2' ? 100 + playTime : playTime,
    duration: playTime,
    playingSlot: true,
    slotType: { playTime },
  } as GameView['timeslot'];
  return {
    game: { id, dayId: 'day-1', timeslotId, fieldId: `field-${id}` } as GameView['game'],
    timeslot,
    timeslotStr: '10:00',
    field: { id: `field-${id}`, name: `Field ${id}` } as GameView['field'],
    coaches: coaches.map(allocation => ({ attendeeAlloc: allocation as any })),
    referees: referees.map(allocation => ({ attendeeAlloc: allocation as any })),
  };
}
