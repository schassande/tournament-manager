const palette = {
  red: {
    name: 'red',
    background:  ['#570f0f', '#701414', '#891818', '#a31d1d', '#bc2121', '#d52626', '#dd3c3c', '#e15555', '#e66e6e', '#ea8888', '#eea1a1', '#f3baba', '#f7d4d4'],
    color:       ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000'],
  },
  blue: {
    name: 'blue',
    background:  ['#0f3357', '#144270', '#185189', '#1d60a3', '#216ebc', '#267dd5', '#3c8cdd', '#559be1', '#6eaae6', '#88b9ea', '#a1c8ee', '#bad7f3', '#d4e5f7'],
    color:       ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000'],
  },
  green: {
    name: 'green',
    background:  ['#0f5727', '#147033', '#18893e', '#1da349', '#21bc55', '#26d560', '#3cdd71', '#55e184', '#6ee696', '#88eaa9', '#a1eebb', '#baf3cd', '#d4f7e0'],
    color:       ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000'],
  },
  orange: {
    name: 'orange',
    background:  ['#57330f', '#704214', '#895118', '#a3601d', '#bc6e21', '#d57d26', '#dd8c3c', '#e19b55', '#e6aa6e', '#eab988', '#eec8a1', '#f3d7ba', '#f7e5d4'],
    color:       ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000'],
  },
  violet: {
    name: 'violet',
    background:  ['#570f0f', '#701414', '#891818', '#a31d1d', '#bc2121', '#d52626', '#dd3c3c', '#e15555', '#e66e6e', '#ea8888', '#eea1a1', '#f3baba', '#f7d4d4'],
    color:       ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000'],
  },
  yellow: {
    name: 'yellow',
    background:  ['#3f0f57', '#511470', '#641889', '#761da3', '#8821bc', '#9b26d5', '#a73cdd', '#b255e1', '#be6ee6', '#c988ea', '#d5a1ee', '#e0baf3', '#ebd4f7'],
    color:       ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000'],
  }
}

export interface WithId {
  id: string; // unique identifier
}

export interface PersistentObject extends WithId {
  lastChange: number; // epoch time of the last change
}

export interface Tournament extends PersistentObject{
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
  fields: Field[]
  days: Day[];
  divisions: Division[];
  managers :TournamentManager[];
  currentScheduleId?: string;
  currentDrawId?: string;
  allowPlayerReferees?: boolean; // true if the tournament has player referees
}

export interface TournamentManager {
  role: AttendeeRole;
  attendeeId: string;
  limit?: {
    dayId?: string;
    partDayId?: string;
    divisionIds?: string[];
    refereeeCategories?: RefereeCategory[];
  }
}

export interface Field extends WithId{
  name: string;
  video: boolean;
  quality: FieldQuality;
  orderView: number;
}
export type FieldQuality = 1 | 2 | 3;

export interface Timeslot extends WithId {
  start: number; // start time of the timeslot
  duration: number; // duration of the timeslot
  end: number; // end time of the timeslot
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
export type RefereeCategory =
  'J' // Junior
  | 'O' // Open
  | 'S' // Senior
  | 'M'; // Master
export interface BasicDivision {
  name: string; // name of the division
  shortName: string; // short name of the division
  backgroundColor: string;
  fontColor: string;
}
export interface Division extends WithId, BasicDivision {
  teams: Team[]; // list of teams in the division
}
export const BasicDivisions: BasicDivision[] = [
  {name: 'Boys under 11',  shortName: 'B11', backgroundColor: palette.orange.background[0], fontColor:palette.orange.color[0]},
  {name: 'Boys under 13',  shortName: 'B13', backgroundColor: palette.orange.background[2], fontColor:palette.orange.color[2]},
  {name: 'Boys under 15',  shortName: 'B15', backgroundColor: palette.orange.background[4], fontColor:palette.orange.color[4]},
  {name: 'Boys under 18',  shortName: 'B18', backgroundColor: palette.orange.background[6], fontColor:palette.orange.color[6]},
  {name: 'Boys under 20',  shortName: 'B20', backgroundColor: palette.orange.background[8], fontColor:palette.orange.color[8]},
  {name: 'Mens open',      shortName: 'MO',  backgroundColor: palette.red.background[0], fontColor:palette.red.color[0]},
  {name: 'Mens over 30',   shortName: 'M30', backgroundColor: palette.red.background[2], fontColor:palette.red.color[2]},
  {name: 'Mens over 35',   shortName: 'M35', backgroundColor: palette.red.background[4], fontColor:palette.red.color[4]},
  {name: 'Mens over 40',   shortName: 'M40', backgroundColor: palette.red.background[6], fontColor:palette.red.color[6]},
  {name: 'Mens over 45',   shortName: 'M45', backgroundColor: palette.red.background[8], fontColor:palette.red.color[8]},
  {name: 'Mens over 50',   shortName: 'M50', backgroundColor: palette.red.background[10], fontColor:palette.red.color[10]},
  {name: 'Mens over 55',   shortName: 'M55', backgroundColor: palette.red.background[12], fontColor:palette.red.color[12]},
  {name: 'Mens over 60',   shortName: 'M60', backgroundColor: palette.red.background[13], fontColor:palette.red.color[14]},

  {name: 'Girls under 11', shortName: 'G11', backgroundColor: palette.yellow.background[0], fontColor:palette.yellow.color[0]},
  {name: 'Girls under 13', shortName: 'G13', backgroundColor: palette.yellow.background[2], fontColor:palette.yellow.color[2]},
  {name: 'Girls under 15', shortName: 'G15', backgroundColor: palette.yellow.background[4], fontColor:palette.yellow.color[4]},
  {name: 'Girls under 18', shortName: 'G18', backgroundColor: palette.yellow.background[6], fontColor:palette.yellow.color[6]},
  {name: 'Girls under 20', shortName: 'G20', backgroundColor: palette.yellow.background[8], fontColor:palette.yellow.color[8]},
  {name: 'Womens open',    shortName: 'WO',  backgroundColor: palette.violet.background[0], fontColor:palette.violet.color[0]},
  {name: 'Womens over 27', shortName: 'W27', backgroundColor: palette.violet.background[2], fontColor:palette.violet.color[2]},
  {name: 'Womens over 30', shortName: 'W30', backgroundColor: palette.violet.background[4], fontColor:palette.violet.color[4]},
  {name: 'Womens over 35', shortName: 'W35', backgroundColor: palette.violet.background[6], fontColor:palette.violet.color[6]},
  {name: 'Womens over 45', shortName: 'W45', backgroundColor: palette.violet.background[8], fontColor:palette.violet.color[8]},
  {name: 'Womens over 50', shortName: 'W50', backgroundColor: palette.violet.background[10], fontColor:palette.violet.color[10]},
  {name: 'Womens over 55', shortName: 'W55', backgroundColor: palette.violet.background[12], fontColor:palette.violet.color[12]},
  {name: 'Womens over 60', shortName: 'W60', backgroundColor: palette.violet.background[13], fontColor:palette.violet.color[13]},

  {name: 'Mixed under 11', shortName: 'X11', backgroundColor: palette.green.background[0], fontColor:palette.green.color[0]},
  {name: 'Mixed under 13', shortName: 'X13', backgroundColor: palette.green.background[2], fontColor:palette.green.color[2]},
  {name: 'Mixed under 15', shortName: 'X15', backgroundColor: palette.green.background[4], fontColor:palette.green.color[4]},
  {name: 'Mixed under 18', shortName: 'X18', backgroundColor: palette.green.background[6], fontColor:palette.green.color[6]},
  {name: 'Mixed under 20', shortName: 'X20', backgroundColor: palette.green.background[8], fontColor:palette.green.color[8]},
  {name: 'Mixed open',     shortName: 'XO',  backgroundColor: palette.blue.background[0], fontColor:palette.blue.color[0]},
  {name: 'Mixed over 30',  shortName: 'X30', backgroundColor: palette.blue.background[2], fontColor:palette.blue.color[2]},
  {name: 'Mixed over 35',  shortName: 'X35', backgroundColor: palette.blue.background[4], fontColor:palette.blue.color[4]},
  {name: 'Mixed over 40',  shortName: 'X40', backgroundColor: palette.blue.background[6], fontColor:palette.blue.color[6]},
  {name: 'Mixed over 45',  shortName: 'X45', backgroundColor: palette.blue.background[8], fontColor:palette.blue.color[8]},

  {name: 'Open',           shortName: 'O',   backgroundColor: '#ffffff', fontColor: '#000000'}
];
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
  roles: AttendeeRole[]; // roles of the attendee (cumulative from partDays field)
  isPlayer: boolean; // true if the attendee is a player
  isReferee: boolean; // true if the attendee is a referee
  isRefereeCoach: boolean; // true if the attendee is a referee coach
  isTournamentManager: boolean; // true if the attendee is a tournament manager
  player? : {
    teamId: string; // unique identifier of the team
    num?: number; // number of the player
  };
  referee? : RefereeInfo;
  refereeCoach? : RefereeCoachInfo;
  partDays: AttendeePartDayInfo[];
  comments?: string;
}
export interface AttendeePartDayInfo {
  dayId: string; // unique identifier of the day
  partDayId: string; // unique identifier of the part day
  roles: AttendeeRole[]; // roles of the attendee
}
export interface RefereeInfo {
  badge: number; // badge of the referee
  badgeSystem: RefereeBadgeSystem; // badge system of the referee coach
  upgrade: { // Looking for upgrade of the referee
    badge: number; // badge of the referee. 0 means no upgrade
    badgeSystem: RefereeBadgeSystem; // badge system of the referee coach
  };
  category: RefereeCategory; // category of the referee
}
export interface RefereeCoachInfo {
  badge: number; // badge of the referee coach
  badgeSystem: RefereeCoachBadgeSystem; // badge system of the referee coach
  upgrade?: { // Looking for upgrade of the referee Coach
    badge: number; // badge of the referee  Coach
    badgeSystem: RefereeBadgeSystem; // badge system of the referee coach
  };
  fontColor: string;
  backgroundColor: string;
}
export type AttendeeRole = 'Referee' | 'Player' | 'Coach' | 'PlayerCoach' | 'PlayerReferee'
  | 'CoachReferee' | 'PlayerCoachReferee' | 'RefereeUpgrade' | 'RefereeRanker' | 'RefereeCoachLeader'
  | 'TournamentManager' | 'GameAllocator' | 'ResultManager';

  export type Gender = 'M' | 'F';

export interface Person extends PersistentObject {
  userAuthId: string;
  firstName: string; // first name of the person
  lastName: string; // name of the person
  shortName: string; // short name of the person
  email: string; // email of the person
  regionId: string; // identifier of region of the person
  countryId: string; // identifier of country of the person
  gender?: Gender,
  photoUrl?: string;
  phone?: string; // phone of  the person
  referee? : RefereeInfo;
  refereeCoach? : RefereeCoachInfo;
}

export interface Referee {
  attendee: Attendee;
  isPR: boolean;
  person?: Person;
  team?: Team;
}
export interface RefereeCoach {
  attendee: Attendee;
  person?: Person;
}

export interface Region extends PersistentObject {
  name: string; // name of the region
  countries: Country[]; // countries of the region
}
export type RefereeBadgeSystem = 4 | 5 | 6;
export type RefereeCoachBadgeSystem = 3 | 4 | 5 | 6;

export interface Country extends WithId {
  name: string; // name of the country
  shortName: string; // short name of the country
  badgeSystem?: RefereeBadgeSystem;
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
  }
  scheduleInfo?: {
    divisionDrawId: string; // unique identifier of the division draw
    stepId: string; // unique identifier of the step
    groupId: string; // unique identifier of the group
    roundId: string; // unique identifier of the round
    roundGameId: string; // unique identifier of the round game
  }
}

export type GameEventType = 'TRY' | 'CONVERSION' | 'PENALTY' | 'YELLOW_CARD' | 'RED_CARD' | 'INJURY' | 'SUBSTITUTION' | 'HALF_TIME' | 'FULL_TIME';
export interface GameEvent extends PersistentObject {
  gameId: string; // unique identifier of the game
  type: GameEventType; // type of the event
  time: number; // time of the event
  player1Id?: string; // player id involved in the event
  player1TeamId?: string; // team if of the player involved in the event
  player2Id?: string; // player id involved in the event
  player2TeamId?: string; // team if of the player involved in the event
}
export interface GameAttendeeAllocation extends PersistentObject {
  tournamentId: string; // unique identifier of the tournament
  refereeAllocationId?: string; // unique identifier of the referee allocation
  gameId: string; // unique identifier of the game
  attendeeId: string; // unique identifier of the referee
  attendeeRole: AttendeeRole; // role of the attendee
  attendeePosition: number;
  half: number; // half of the game where the attendee is allocated
}

export interface RefereeAllocation extends PersistentObject {
  name: string; // unique identifier of the game
  tournamentId: string; // unique identifier of the tournament
  dayId: string;
  partDayId?: string;
  refereeAllocatorAttendeeIds: string[]; // unique identifier of the author of the referee allocator
  refereeCoachAllocatorAttendeeIds: string[]; // unique identifier of the author of the referee coach allocator
  active: boolean; // true if the allocation is active
  visible: boolean; // true if the allocation is visible
}

export interface AllocationStatistics extends PersistentObject {
  tournamentId: string; // unique identifier of the tournament
  refereeAllocationId: string; // unique identifier of the referee allocation
  refereeStatistics: RefereeAllocationAllStatistics[];
  nbGames: number; // number of games

}

export interface RefereeAllocationStatistics {
  coaching: {
    nbCoachedGames: number; // number of games coached by a referee coach
    averageCoachingLevel: number; // Average level of the coaching
  };
  buddies: {
    buddyAttendeeId: string;
    nbGames: number; // number of games allocated to the buddy
  }[];
  teams: {
    teamId: string; // unique identifier of the team
    divisionId: string; // unique identifier of the division
    nbGames: number;
  }[];
  nbGamesOnBadField: number; // number of games on bad fields
  nbGamesOnVideao: number; // number of streamed games
  firstTimeSlot: number; // first time slot of the game
}

export interface RefereeAllocationAllStatistics extends RefereeAllocationStatistics {
  refereeAttendeeId: string;
  partDays: RefereePartDayAllocationStatistics[];
}

export interface RefereePartDayAllocationStatistics extends RefereeAllocationStatistics {
  dayId: string;
  partDayId?: string;
  gameIds: {
    gameId: string; // unique identifier of the game
    divisionId: string; // unique identifier of the division
    divisionShortName: string
    timeSlotId: string; // unique identifier of the timeslot
  }[]; // list of game ids allocated to the referee
  coachedGames: { // list of game ids coached by the referee coach
    gameId: string; // unique identifier of the game
    refereeCoachAttendeeIds: string[]; // List of coach during the games
  }[];
}


export interface Schedule extends PersistentObject {
  tournamentId: string; // unique identifier of the tournament
  drawId: string; // unique identifier of the draw
  name: string; // name of the schedule
  authorAttendeeId: string; // unique identifier of the author (Attendee)
  scheduledGames : ScheduleGame[];
}
export interface ScheduleGame {
  dayId: string;
  parDayId: string;
  timeSlotId: string;
  fieldId: string;
  gameId: string;
}

export interface SlotType extends PersistentObject{
  name: string;
  nbPeriod: number;
  periodDuration: number;
  breakDuration: number;
  interGameDuration: number;
  extraTimeDuration: number;
  totalDuration: number;
  playTime: number;
}

export interface Draw extends PersistentObject{
  tournamentId: string;
  timeSlotconfigs: TimeSlotConfig[];
  authorId: string;
  divisionDraws: DivisionDraw[];
}

export interface TimeSlotConfig {
  dayId: string;
  partDayId: string;
  startTime: number;
  endTime: number;
  slotType: SlotType;
  slotDuration: number;
}

export interface DivisionDraw extends WithId {
  divisionId: string;
  steps: Step[];
}
export interface Step extends WithId {
  position: number;
  name: string;
  type: StepType;
  teamSelectionMode: TeamSelectionMode;
  groups: Group[];
}

export interface StepType {
  nbteams: number;
  name: string;
  nbGames: number;
  nbGroup: number;
  groups: StepGroup[];
}

export interface Group extends WithId {
  name: string;
  type: GroupType;
  inputTeamRankedIds: string[];
  outputTeamRankedIds: string[];
  gameIds: string[];
}

export interface StepGroup {
  type: GroupType;
}
export interface GroupType {
  /* POOL, POOL_RET, POOL_3,
    2_WINS, 3_WINS,
    CUP2_RK2,
    CUP4_RK2, CUP4_RK4,
    CUP8_RK2, CUP8_RK4, CUP8_RK8
    CUP16_RK2, CUP16_RK4, CUP16_RK8, CUP16_RK16, CUP32_RK2,
    CUP32_RK4, CUP32_RK8, CUP32_RK16, CUP32_RK32
  */
  name: string;
  nbTeams: number;
  nbGames: number;
  sourceCode: string;
  rounds: Round[];
  nbRankedTeams: number;
}
export interface Round extends WithId {
  rank: number;
  name?: string;
  roundGames: RoundGame[];
}
export interface RoundGame extends WithId {
  name: string;
  teamASourceType: 'GameWinner' | 'GameLoser' | 'InputRank';
  teamASourceRoundGameId: string
  teamBSourceType: 'GameWinner' | 'GameLoser' | 'InputRank';
  teamBSourceRoundGameId: string
}
export type DefaultGroupName = 'Cup' | 'Plate' | 'Bowl' | 'Shield' | 'Spoon' | 'Saucer';
export const defaultGroupNames: DefaultGroupName[] = [ 'Cup', 'Plate', 'Bowl', 'Shield', 'Spoon', 'Saucer'];

export type TeamSelectionMode = 'Random' | 'BestTogether' | 'SpreadBest';
