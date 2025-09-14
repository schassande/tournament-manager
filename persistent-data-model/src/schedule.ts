import { PersistentObject, WithId } from "./persistence";
import { TimeSlotConfig } from "./tournament";

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

export interface Draw extends PersistentObject{
  tournamentId: string;
  timeSlotconfigs: TimeSlotConfig[];
  authorId: string;
  divisionDraws: DivisionDraw[];
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
