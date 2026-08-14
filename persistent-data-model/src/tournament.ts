import { PersistentObject, WithId } from './persistence';
import { AttendeeRole } from './person';
import { RefereeCategory, RefereeCoachInfo, RefereeInfo } from './referee';

export interface Tournament extends PersistentObject {
  name: string;
  description: string;
  startDate: number;
  endDate: number;
  nbDay: number;
  venue: string;
  city: string;
  countryId: string;
  regionId: string;
  timeZone: string;
  fields: Field[];
  days: Day[];
  divisions: Division[];
  managerAttendeeIds: string[];
  managerEmails: string[];
  currentScheduleId?: string;
  currentDrawId?: string;
  allowPlayerReferees?: boolean; // true if the tournament has player referees
  /** FIT competition selection and the user's persistent import naming rules. */
  fit?: FitTournamentConfig;
}

/** Persistent configuration used by the FIT import preparation page. */
export interface FitTournamentConfig {
  competitionSlug: string;
  season: string;
  /** IANA time zone used to display imported FIT match dates and times. */
  targetTimeZone: string;
  renaming: FitRenamingConfig;
  /** ISO date-time of the last successful FIT download. */
  lastImportDate: string;
}

/** User-defined name associated with an exact FIT value. */
export interface FitRenaming {
  fitName: string;
  appName: string;
}

/** All persisted FIT naming options. Team names are keyed by their displayed FIT name. */
export interface FitRenamingConfig {
  divisions: FitRenaming[];
  teams: FitRenaming[];
  fields: FitRenaming[];
  capitalizeTeamName: boolean;
}

export interface Field extends WithId {
  name: string;
  video: boolean;
  quality: FieldQuality;
  orderView: number;
}
export type FieldQuality = 1 | 2 | 3;

export interface SlotType extends PersistentObject {
  name: string;
  nbPeriod: number;
  /** Duration of the period in minute */
  periodDuration: number;
  /** Duration of the break in minute */
  breakDuration: number;
  /** Duration of the free time in minute */
  interGameDuration: number;
  /** Duration of the extra time in minute */
  extraTimeDuration: number;
  /** Total Duration of the slot in minute */
  totalDuration: number;
  /** Play time Duration of the slot in minute */
  playTime: number;
}

export interface Timeslot extends WithId {
  start: number; // start time of the timeslot
  duration: number; // duration of the timeslot
  end: number; // end time of the timeslot
  slotType: SlotType;
  playingSlot: boolean;
}

export interface Day extends WithId {
  date: number;
  parts: PartDay[];
}
export interface PartDay extends WithId {
  dayId: string;
  timeslots: Timeslot[]; // game and break timeslots
  allFieldsAvaillable: boolean;
  availableFieldIds: string[];
}
export interface BasicDivision {
  name: string; // name of the division
  shortName: string; // short name of the division
  backgroundColor: string;
  fontColor: string;
}
export interface Division extends WithId, BasicDivision {
  teams: Team[]; // list of teams in the division
}
export interface Team extends WithId {
  name: string; // name of the team
  shortName: string; // short name of the team
  divisionName: string; // name of the division
  playerIds?: string[]; // list of players in the team
}
export interface TeamDivision extends Team {
  divisionShortName: string;
}

export interface Attendee extends PersistentObject {
  tournamentId: string; // unique identifier of the tournament
  personId: string; // unique identifier
  roles: AttendeeRole[]; // roles of the attendee. it can have some restrictions
  isPlayer: boolean; // true if the attendee is a player
  isReferee: boolean; // true if the attendee is a referee
  isRefereeCoach: boolean; // true if the attendee is a referee coach
  isTournamentManager: boolean; // true if the attendee is a tournament manager
  player?: {
    teamId: string; // unique identifier of the team
    num?: number; // number of the player
  };
  referee?: RefereeInfo;
  refereeCoach?: RefereeCoachInfo;
  roleRestrictions?: AttendeeRoleRestriction[]; // Define the exact rights of the attendee
  comments?: string;
}
export interface AttendeeRoleRestriction {
  role: AttendeeRole; // roles of the attendee
  dayId?: string; // unique identifier of the day. No value means all.
  partDayId?: string; // unique identifier of the part day. No value means all.
  divisionIds?: string[]; // list of limited division. No value means all.
  refereeeCategories?: RefereeCategory[]; // list of limited referee categories. No value means all.
}

export interface TimeSlotConfig {
  dayId: string;
  partDayId: string;
  startTime: number;
  endTime: number;
  slotType: SlotType;
  slotDuration: number;
}

export interface Game extends PersistentObject {
  tournamentId: string; // unique identifier of the tournament
  scheduleId: string; // unique identifier of the schedule
  divisionId: string; // unique identifier of the division
  dayId: string; // unique identifier of the day
  partDayId: string; //
  timeslotId: string; // unique identifier of the timeslot
  fieldId: string; // unique identifier of the field
  homeTeamId: string; // unique identifier of the home team
  awayTeamId: string; // unique identifier of the away team
  score?: {
    homeTeamScore: number; // score of the home team
    awayTeamScore: number; // score of the away team
  };
  scheduleInfo?: {
    divisionDrawId: string; // unique identifier of the division draw
    stepId: string; // unique identifier of the step
    groupId: string; // unique identifier of the group
    roundId: string; // unique identifier of the round
    roundGameId: string; // unique identifier of the round game
  };
  fitGameId?: number;
}

export type GameEventType =
  | 'TRY'
  | 'CONVERSION'
  | 'PENALTY'
  | 'YELLOW_CARD'
  | 'RED_CARD'
  | 'INJURY'
  | 'SUBSTITUTION'
  | 'HALF_TIME'
  | 'FULL_TIME';
export interface GameEvent extends PersistentObject {
  gameId: string; // unique identifier of the game
  type: GameEventType; // type of the event
  time: number; // time of the event
  player1Id?: string; // player id involved in the event
  player1TeamId?: string; // team if of the player involved in the event
  player2Id?: string; // player id involved in the event
  player2TeamId?: string; // team if of the player involved in the event
}
