import { Attendee, Day, Division, Field, Game, GameAttendeeAllocation, PartDay, Person, Referee, RefereeCoach, Team, Timeslot } from "src/app/shared/data.model";

export interface DayView extends Day {
  label: string;
  partViews: PartView[];
}
export interface PartView extends PartDay{
  timeSlotViews: TimeSlotView[];
  fields: Field[];
}
export interface TimeSlotView extends Timeslot {
  startStr: string;
  endStr: string;
  durationStr: string;
  fields: FieldView[];
}
export interface FieldView extends Field {
  game?: GameView;
}
export interface GameView {
  game: Game;
  division?: Division;
  timeslot?: Timeslot;
  timeslotStr: string;
  field?: Field;
  homeTeam?: Team;
  awayTeam?: Team;
  coaches: GameAttendeeAllocationView[];
  referees: GameAttendeeAllocationView[];
}
export interface GameAttendeeAllocationView {
  attendeeAlloc: GameAttendeeAllocation
  referee?: Referee;
  coach?: RefereeCoach;
}
