export interface WithId {
    id: string;
}
export interface PersistentObject extends WithId {
    lastChange: number;
}
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
    managers: TournamentManager[];
    currentScheduleId?: string;
    currentDrawId?: string;
    allowPlayerReferees?: boolean;
}
export interface TournamentManager {
    role: AttendeeRole;
    attendeeId: string;
    limit?: {
        dayId?: string;
        partDayId?: string;
        divisionIds?: string[];
        refereeeCategories?: RefereeCategory[];
    };
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
    start: number;
    duration: number;
    end: number;
    slotType: SlotType;
    playingSlot: boolean;
}
export interface Day extends WithId {
    date: number;
    parts: PartDay[];
}
export interface PartDay extends WithId {
    dayId: string;
    timeslots: Timeslot[];
    allFieldsAvaillable: boolean;
    availableFieldIds: string[];
}
export type RefereeCategory = 'J' | 'O' | 'S' | 'M';
export interface BasicDivision {
    name: string;
    shortName: string;
    backgroundColor: string;
    fontColor: string;
}
export interface Division extends WithId, BasicDivision {
    teams: Team[];
}
export declare const BasicDivisions: BasicDivision[];
export interface Team extends WithId {
    name: string;
    shortName: string;
    divisionName: string;
    playerIds?: string[];
}
export interface TeamDivision extends Team {
    divisionShortName: string;
}
export interface Attendee extends PersistentObject {
    tournamentId: string;
    personId: string;
    roles: AttendeeRole[];
    isPlayer: boolean;
    isReferee: boolean;
    isRefereeCoach: boolean;
    isTournamentManager: boolean;
    player?: {
        teamId: string;
        num?: number;
    };
    referee?: RefereeInfo;
    refereeCoach?: RefereeCoachInfo;
    partDays: AttendeePartDayInfo[];
    comments?: string;
}
export interface AttendeePartDayInfo {
    dayId: string;
    partDayId: string;
    roles: AttendeeRole[];
}
export interface RefereeInfo {
    badge: number;
    badgeSystem: RefereeBadgeSystem;
    upgrade: {
        badge: number;
        badgeSystem: RefereeBadgeSystem;
    };
    category: RefereeCategory;
}
export interface RefereeCoachInfo {
    badge: number;
    badgeSystem: RefereeCoachBadgeSystem;
    upgrade?: {
        badge: number;
        badgeSystem: RefereeBadgeSystem;
    };
    fontColor: string;
    backgroundColor: string;
}
export type AttendeeRole = 'Referee' | 'Player' | 'Coach' | 'PlayerCoach' | 'PlayerReferee' | 'CoachReferee' | 'PlayerCoachReferee' | 'RefereeUpgrade' | 'RefereeRanker' | 'RefereeCoachLeader' | 'TournamentManager' | 'GameAllocator' | 'ResultManager';
export type Gender = 'M' | 'F';
export interface Person extends PersistentObject {
    userAuthId: string;
    firstName: string;
    lastName: string;
    shortName: string;
    email: string;
    regionId: string;
    countryId: string;
    gender?: Gender;
    photoUrl?: string;
    phone?: string;
    referee?: RefereeInfo;
    refereeCoach?: RefereeCoachInfo;
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
    name: string;
    countries: Country[];
}
export type RefereeBadgeSystem = 4 | 5 | 6;
export type RefereeCoachBadgeSystem = 3 | 4 | 5 | 6;
export interface Country extends WithId {
    name: string;
    shortName: string;
    badgeSystem?: RefereeBadgeSystem;
}
export interface Game extends PersistentObject {
    tournamentId: string;
    scheduleId: string;
    divisionId: string;
    dayId: string;
    partDayId: string;
    timeslotId: string;
    fieldId: string;
    homeTeamId: string;
    awayTeamId: string;
    score?: {
        homeTeamScore: number;
        awayTeamScore: number;
    };
    scheduleInfo?: {
        divisionDrawId: string;
        stepId: string;
        groupId: string;
        roundId: string;
        roundGameId: string;
    };
}
export type GameEventType = 'TRY' | 'CONVERSION' | 'PENALTY' | 'YELLOW_CARD' | 'RED_CARD' | 'INJURY' | 'SUBSTITUTION' | 'HALF_TIME' | 'FULL_TIME';
export interface GameEvent extends PersistentObject {
    gameId: string;
    type: GameEventType;
    time: number;
    player1Id?: string;
    player1TeamId?: string;
    player2Id?: string;
    player2TeamId?: string;
}
export interface GameAttendeeAllocation extends PersistentObject {
    tournamentId: string;
    refereeAllocationId?: string;
    gameId: string;
    attendeeId: string;
    attendeeRole: AttendeeRole;
    attendeePosition: number;
    half: number;
}
export interface RefereeAllocation extends PersistentObject {
    name: string;
    tournamentId: string;
    dayId: string;
    partDayId?: string;
    refereeAllocatorAttendeeIds: string[];
    refereeCoachAllocatorAttendeeIds: string[];
    active: boolean;
    visible: boolean;
}
export interface AllocationStatistics extends PersistentObject {
    tournamentId: string;
    refereeAllocationId: string;
    refereeStatistics: RefereeAllocationAllStatistics[];
    nbGames: number;
}
export interface RefereeAllocationStatistics {
    coaching: {
        nbCoachedGames: number;
        averageCoachingLevel: number;
    };
    buddies: {
        buddyAttendeeId: string;
        nbGames: number;
    }[];
    teams: {
        teamId: string;
        divisionId: string;
        nbGames: number;
    }[];
    nbGamesOnBadField: number;
    nbGamesOnVideao: number;
    firstTimeSlot: number;
}
export interface RefereeAllocationAllStatistics extends RefereeAllocationStatistics {
    refereeAttendeeId: string;
    partDays: RefereePartDayAllocationStatistics[];
}
export interface RefereePartDayAllocationStatistics extends RefereeAllocationStatistics {
    dayId: string;
    partDayId?: string;
    gameIds: {
        gameId: string;
        divisionId: string;
        divisionShortName: string;
        timeSlotId: string;
    }[];
    coachedGames: {
        gameId: string;
        refereeCoachAttendeeIds: string[];
    }[];
}
export interface Schedule extends PersistentObject {
    tournamentId: string;
    drawId: string;
    name: string;
    authorAttendeeId: string;
    scheduledGames: ScheduleGame[];
}
export interface ScheduleGame {
    dayId: string;
    parDayId: string;
    timeSlotId: string;
    fieldId: string;
    gameId: string;
}
export interface Draw extends PersistentObject {
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
    teamASourceRoundGameId: string;
    teamBSourceType: 'GameWinner' | 'GameLoser' | 'InputRank';
    teamBSourceRoundGameId: string;
}
export type DefaultGroupName = 'Cup' | 'Plate' | 'Bowl' | 'Shield' | 'Spoon' | 'Saucer';
export declare const defaultGroupNames: DefaultGroupName[];
export type TeamSelectionMode = 'Random' | 'BestTogether' | 'SpreadBest';
/**
 * Creates a new SlotType with the given parameters.
 * @param name - The name of the slot type.
 * @param nbPeriod - The number of periods in the slot type.
 * @param periodDuration - The duration of each period in minutes.
 * @param breakDuration - The duration of the break in minutes.
 * @param extraTimeDuration - The duration of the extra time in minutes.
 * @param interGameDuration - The duration of the inter-game break in minutes.
 * @return A new SlotType object with the specified parameters.
 */
export declare function newSlotType(name: string, nbPeriod: number, periodDuration: number, breakDuration: number, extraTimeDuration: number, interGameDuration: number): SlotType;
export declare const defaultSlotType: SlotType;
export declare const defaultSloTypes: SlotType[];
//# sourceMappingURL=data.model.d.ts.map