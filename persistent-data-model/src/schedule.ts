import { PersistentObject, WithId } from "./persistence";

/** Definition of a draw for one division of a tournament */
export interface DivisionDraw extends PersistentObject {
  /** Identifier of the tournament */
  tournamentId: string;
  /** name of the draw */
  name: string;
  /** id of the division Division.id */
  divisionId: string;
  /** List of the step composing this draw */
  steps: Step[];
  /** 
   * List of Atttendee.id in charge of the manager of this DrawDivision 
   * in addition to the tournament managers
   */
  managerAttendeeIds: string[];
  /** 
   * List of point calculation configurations. Can be empty 
   * if this configuration is not required (no POOL group type).
   * Can have several configs
   */
  pointCalculations: PointCalculation[];
}

/** Define the point calculation configuration */
export interface PointCalculation extends WithId {
  /** Name of the configuration */
  name: string;
  /** Number of point when a team wins a game */
  winPoint: number;
  /** Number of point when a team loses a game */
  lostPoint: number;
  /** Number of point when a game is a draw*/
  drawPoint: number;
  /** Ordered list of the criteria for ranking teams */
  rankingCriteria?: RankingCriteria[];
}

export const DEFAULT_RANKING_CRITERIA: RankingCriteria[] = ['POINTS', 'GOAL_AVERAGE',  'WIN',  'CUMULATED_SCORE'];

/**
 * For a given competition and divisions, this class defines a Step of the competition. 
 * In a step, there are input teams (from previous step, registred team of the competition)
 * A step produces input teams
 */
export interface Step extends WithId {
  /** Status of the Step */
  status: StepStatus;
  /** Position of the step in the Draw (0 based value) */
  position: number;
  /** Name of the step */
  name: string;
  /** identifier of the DrawLib describing the structure of the draw for this step */
  drawType: DrawType;
  /** Define a way the teams from the previous step are splited over the groups of the step */
  spreadTeamsAlgo: SpreadTeamsAlgo;
  /** Sorted list of the teams as input of the Step. */
  inputTeams: TeamReference[];
  /** The list of the groups in this step */
  groups: Group[];
  /** Sorted list of the teams as output of the Step. */
  outputTeams: TeamReference[];
  /** Define the way the ouput teams are ranked  */
  ouputTeamRankingStrategy?: OuputTeamRankingStrategy;
}

/** 
 * Define the way the ouput teams are ranked in the step. 
 * Assumption: Each group produces a ranked list of its teams.
 */
export type OuputTeamRankingStrategy = 
  'GROUP_ORDER' // output teams list is built by the ranking of the first group, then the ranking of the second group
  | 'BEST_TOGETHER' // output teams list is built by taking the first of each group firstly, then second of each group...
  ;

/** Lifecycle status of a competition step. */
export type StepStatus = 'DRAFT' | 'DRAWN' | 'PLANIFYING' | 'PLANIFIED' | 'RUNNING' | 'FINISHED' | 'CANCELED';

/** 
 * Define a group of teams and games in a step. It can 
 * contain specific data for configuration or for the run.  
 */
export interface Group extends WithId {
  /** Position of the Group in the Step. 0 based value */
  position: number;
  /** Type of the group. It defines the structure of the competition for this step and a set of teams */
  type: GroupType;
  /** Name of the group */
  name: string;
  /** List of the game definition */
  games: DrawGame[];
  /** List of the team sorted by the rank */
  teams: TeamReference[];
  /** Additionnal data specific to the GroupType. It can contains configuration items and Running data. */
  specificData: SpecificData;
}
/** Generic type for the specific data */
export interface SpecificData {}
/** Generic type for the specific data containing configuration elements */
export interface SpecificDataForConfig extends SpecificData {}
/** Generic type for the specific data containing run elements */
export interface SpecificDataForRun extends SpecificData {}
/** Define the specific data for configuration when the Group has a GroupType requiring points per team */
export interface PointCalculationConfig extends SpecificDataForConfig {
  /** Identifier of PointCalculation defined in the DrawDivision */
  pointCalculationId: string;
}
/** 
 * Define the specific data when the Group has a GroupType requiring points per team.
 * It contains configuration and run part.
 */
export interface SpecificDataPool extends PointCalculationConfig, SpecificDataForRun {
  /** Data structure storing the points for each team. */
  teamsPoints: TeamPoint[];
}
export interface SpecificDataCup extends SpecificDataForRun {
  ouputTeams: TeamReference[];
}
/** 
 * Define a structure for storing data about a team. 
 * It can be used to manage points and ranking in a Pool draw.
 */
export interface TeamPoint {
  /** Reference to a team */
  team: TeamReference;
  /** Number of played games by the team */
  played: number;
  /** Number of wan games by the team */
  win: number;
  /** Number of lost games by the team */
  lost: number;
  /** Number of draw games by the team */
  draw: number;
  /** Number of points by the team */
  points: number;
  /** Cumulated try scored by the team */
  cumulatedScore: number;
  /** Cumulated try scored by the opposite team */
  cumulatedOppositeScore: number;
  /** Computation = cumulatedScore - cumulatedOppositeScore */
  goalAverage: number;
  /** Rank of the team in the group. Several team can have the same rank in the group */
  rank: number;
}

export type RankingCriteria = 'POINTS' | 'GOAL_AVERAGE' | 'WIN' | 'CUMULATED_SCORE' | 'CUMULATED_OPPOSITE_SCORE';

/** A game of the DrawGroup */
export interface DrawGame extends WithId {
  /** The identifier of the real game  */
  gameId?: string;
  /** Round of the game in the Step */
  round: number;
  /** description of the game: Pool, Semi final, final, 3rd, 5th .. */
  what: string;
  resultRequired: boolean;
  status: 'DRAWN' // Game is defined in the draw but not already planified
    | 'PLANIFIED' // allocated on day/slot and fields
    | 'READY_TO_PLAY' // has teams and referees
    | 'PLAYING' // Both teams are playing the game
    | 'FINISHED' // Game is finish and there is a score
    | 'CANCELED' // game is canceled
    ;
  /** The home team of the game */
  homeTeam: TeamReference;
  /** The away team of the game */
  awayTeam: TeamReference;
}

/** Define a Team involved in a DrawGame. This teams could be unknown from the begining because 
 * it could depend on the result of a game. */
export interface TeamReference {
  teamSelectorType:'RANK_IN_STEP' | 'RANK_IN_GROUP' | 'WINNER_OF' | 'LOSER_OF' | 'MANUAL' | 'TEAM_ID';
  /** used when teamSelectorType is 'WINNER_OF' | 'LOER_OF' */
  drawGameId?: string;
  /** used when teamSelectorType is 'RANK_IN_GROUP' */
  groupId?: string;
  /** used when teamSelectorType is 'RANK_IN_STEP' */
  stepId?: string;
  /** used when teamSelectorType is 'RANK_IN_STEP' or 'RANK_IN_GROUP' */
  rank?: number;
  /** used 
   *  - when the team is known during the competition. 
   *  - when teamSelectorType is 'MANUAL' or 'TEAM_ID'
   */
  teamId?: string;
}

/** 
 * Define a Draw between teams. Teams are splited in groups. Each group has its draw type. 
 * The database contains all possible draws supported by the application. 
 * This class is persistent in the firestore.
 */
export interface PDrawType extends DrawType, PersistentObject {
  enabled: boolean;
}

/** 
 * Define a Draw between teams. Teams are splited in groups. 
 * Each group has its draw type. 
 */
export interface DrawType {
  /** 
   * Number of teams managed by the draw type. 
   * It is the cumulated value of groups.nbTeam
   */
  nbTeam: number;
  /** NAme of the draw type */
  drawName: string;
  /** number of sub group in this draw type. It equals groups.length */
  nbGroup: number;
  /** 
   * Number of the game organised by this Draw type. 
   * It is the cumulated value of groups.nbGames
   */
  nbGames : number;
  /** Flag indicating if the draw type requires PointCalculation config */
  requirePointCalculationConfig: boolean;
  /** Sub groups of this drawType */
  groups: DrawTypeSubGroup[];
  /** Description of the draw type */
  description?: string;
}

/** A Sub group of the Draw Type */
export interface DrawTypeSubGroup {
  /** Position of the sub group in the DrawType. 0 based value. */
  position: number;
  /** Number of teams managed in this sub group */
  nbTeams: number;
  /** Type of the sub group */
  groupType: GroupType;
  /** Number of the game organised by this sub group. */
  nbGames: number;
}

/**Define the method to spread the teams over several groups */
export type SpreadTeamsAlgo = 'Random' // randomly
  | 'Best teams together' // First group contains the best teams, second group contains the next best teams ...
  | 'Spread best teams' // Allocate like a snake. Rank 1 is in first group, Rank 2 is in second group, Rank 3 in third group ...
  |' Manual';

/** Define the type of draw for a group of teams */
export type GroupType = 'NONE' 
  | 'POOL' | 'POOL_RET' | 'POOL_3'
  | '2_WINS'  | '3_WINS' | '4_WINS' | '5_WINS' 
  | 'CUP2_RK2'
  | 'RANKING' | 'SEMI' 
  | 'CUP4_RK2'   | 'CUP4_RK4' 
  | 'CUP8_RK2'   | 'CUP8_RK4'   | 'CUP8_RK8'
  | 'CUP16_RK2'  | 'CUP16_RK4'  | 'CUP16_RK8' 
  | 'CUP32_RK2'  | 'CUP32_RK4'  | 'CUP32_RK8' 
  | 'CUP64_RK2'  | 'CUP64_RK4'  | 'CUP64_RK8' 
  | 'CUP128_RK2' | 'CUP128_RK4' | 'CUP128_RK8'
  ;

/** Default DrawType to make persistent. */
export const default_drawlibs: DrawType[] = [
  createDrawType(2, '2 teams, Simple',             createDrawTypeGroup(0, 2,	'CUP2_RK2',	1)),
  createDrawType(2, '2 teams, 2 times final',      createDrawTypeGroup(0, 2,	'POOL_RET',	2)),
  createDrawType(2, '2 teams, wins',               createDrawTypeGroup(0, 2,	'2_WINS',	3)),
  createDrawType(2, '2 teams, 3 wins',             createDrawTypeGroup(0, 2,	'3_WINS',	5)),
  
  createDrawType(3, '3 teams, 1 pool',             createDrawTypeGroup(0, 3,	'POOL',	3)),
  createDrawType(3, '3 teams, 1 pool with return', createDrawTypeGroup(0, 3,	'POOL_RET',	6)),

  createDrawType(4, '4 teams, 1 pool',             createDrawTypeGroup(0, 4,	'POOL',	6)),
  createDrawType(4, '4 teams, 1 pool with return', createDrawTypeGroup(0, 4,	'POOL_RET',	12)),
  createDrawType(4, '4 teams, cup & ranking',      createDrawTypeGroup(0, 4,	'CUP4_RK2',	12)),
  createDrawType(4, '4 teams, 1vs2 + 3vs4',        createDrawTypeGroup(0, 2,	'CUP2_RK2',	1),   createDrawTypeGroup(1, 2,	'CUP2_RK2',	1)),

  createDrawType(5, '5 teams, 1 pool',             createDrawTypeGroup(0, 5,	'POOL',	10)),
  createDrawType(5, '5 teams, pool return',        createDrawTypeGroup(0, 5,	'POOL_RET',	20)),
  createDrawType(5, '5 teams, 1vs2 + 3vs4 + none', createDrawTypeGroup(0, 2,	'CUP2_RK2',	1),   createDrawTypeGroup(1, 2,	'CUP2_RK2',	1),   createDrawTypeGroup(2, 1,	'NONE',	0)),

  createDrawType(6, '6 teams, pool',               createDrawTypeGroup(0, 6,	'POOL',	15)),
  createDrawType(6, '6 teams, pool +  Return',     createDrawTypeGroup(0, 6,	'POOL_RET',	30)),
  createDrawType(6, '6 teams, 2 pools',            createDrawTypeGroup(0, 3,	'POOL',	3),      createDrawTypeGroup(1, 3,	'POOL',	3)),
  createDrawType(6, '6 teams, 2 pools + Return',   createDrawTypeGroup(0, 3,	'POOL_RET',	3),  createDrawTypeGroup(1, 3,	'POOL_RET',	3)),
  createDrawType(6, '6 teams, Cup4 + Cup2',        createDrawTypeGroup(0, 4,	'CUP4_RK4',	4),  createDrawTypeGroup(1, 2,	'CUP2_RK2',	1)),
  createDrawType(6, '6 teams, Cup4 + none',        createDrawTypeGroup(0, 4,	'CUP4_RK4',	4),  createDrawTypeGroup(1, 2,	'NONE',	0)),
  createDrawType(6, '6 teams, None4 + Cup2',       createDrawTypeGroup(0, 2,	'NONE',	0),      createDrawTypeGroup(1, 4,	'RANKING',	2)),
  createDrawType(6, '6 teams, Cup2 + None4',       createDrawTypeGroup(0, 2,	'CUP2_RK2',	1),  createDrawTypeGroup(1, 2,	'NONE',	0),),

  createDrawType(7, '7 teams, pool',               createDrawTypeGroup(0, 7,	'POOL',	21)),    
  createDrawType(7, '7 teams, pool + return',      createDrawTypeGroup(0, 7,	'POOL_RET',	42)),
  createDrawType(7, '7 teams, pool4 + pool3',      createDrawTypeGroup(0, 4,	'POOL',	6),      createDrawTypeGroup(1, 3,	'POOL',	3)), 
  createDrawType(7, '7 teams, Cup4 + Pool3',       createDrawTypeGroup(0, 4,	'CUP4_RK4',	4),  createDrawTypeGroup(1, 3,	'POOL',	3)), 

  createDrawType(8, '8 teams, pool',               createDrawTypeGroup(0, 8,	'POOL',	21)),    
  createDrawType(8, '8 teams, cup & full ranking', createDrawTypeGroup(0, 8,	'CUP8_RK8',	24)),
  createDrawType(8, '8 teams, cup & ranking 4',    createDrawTypeGroup(0, 8,	'CUP8_RK4',	8)),
  createDrawType(8, '8 teams, cup & ranking 2',    createDrawTypeGroup(0, 8,	'CUP8_RK2',	7)),
  createDrawType(8, '8 teams, pool4 + pool4',      createDrawTypeGroup(0, 4,	'POOL',	6),      createDrawTypeGroup(1, 4,	'POOL',	6)),    
  createDrawType(8, '8 teams, pool4R + pool4R',    createDrawTypeGroup(0, 4,	'POOL_RET',	12), createDrawTypeGroup(1, 4,	'POOL_RET',	12)),    
  createDrawType(8, '8 teams, cup4 + cup4',        createDrawTypeGroup(0, 4,	'CUP4_RK4',	4),  createDrawTypeGroup(1, 4,	'CUP4_RK4',	4)),

  createDrawType(9, '9 teams, pool5 + pool4',      createDrawTypeGroup(0, 5,	'POOL',	10),     createDrawTypeGroup(1, 4,	'POOL',	6)),    
  createDrawType(9, '9 teams, pool5 + pool4R',     createDrawTypeGroup(0, 5,	'POOL',	10),     createDrawTypeGroup(1, 4,	'POOL_RET',	6)),    
  createDrawType(9, '9 teams, 3 x pool3',          createDrawTypeGroup(0, 3,	'POOL',	3),      createDrawTypeGroup(1, 3,	'POOL',	3),       createDrawTypeGroup(2, 3,	'POOL',	3)),    

  createDrawType(10, '10 teams, 2 x pool5',        createDrawTypeGroup(0, 5,	'POOL',	10),     createDrawTypeGroup(1, 5,	'POOL',	10)),    
  createDrawType(10, '10 teams, 2 x pool5R',       createDrawTypeGroup(0, 5,	'POOL_RET',	20), createDrawTypeGroup(1, 5,	'POOL_RET',	20)),    
  createDrawType(10, '10 teams, pool4 + 2xpool3',  createDrawTypeGroup(0, 4,	'POOL',	6),      createDrawTypeGroup(1, 3,	'POOL',	3),       createDrawTypeGroup(2, 3,	'POOL',	3)),    
  createDrawType(10, '10 teams, 2xcup4 + 2wins',   createDrawTypeGroup(0, 4,	'CUP4_RK4',	4),  createDrawTypeGroup(1, 4,	'CUP4_RK4',	4),   createDrawTypeGroup(2, 2,	'2_WINS',	3)),
  createDrawType(10, '10 teams, cup8 + 2wins',     createDrawTypeGroup(0, 8,	'CUP8_RK4',	8),  createDrawTypeGroup(1, 2,	'2_WINS',	3)),

  createDrawType(11, '11 teams, 3 x pool443',      createDrawTypeGroup(0, 4,	'POOL',	6),      createDrawTypeGroup(1, 4,	'POOL',	6),       createDrawTypeGroup(2, 3,	'POOL',	3)),    
  createDrawType(11, '11 teams, 2xCup4 + pool3',   createDrawTypeGroup(0, 4,	'CUP4_RK4',	4),  createDrawTypeGroup(1, 4,	'CUP4_RK4',	4),   createDrawTypeGroup(2, 3,	'POOL',	3)),    

  createDrawType(12, '12 teams, 3 x pool',         createDrawTypeGroup(0, 4,	'POOL',	6),      createDrawTypeGroup(1, 4,	'POOL',	6),       createDrawTypeGroup(2, 4,	'POOL',	6)),    
  createDrawType(12, '12 teams, 3xCup4',           createDrawTypeGroup(0, 4,	'CUP4_RK4',	4),  createDrawTypeGroup(1, 4,	'CUP4_RK4',	4),   createDrawTypeGroup(2, 4,	'CUP4_RK4',	4)),    

  /*
  createDrawType(13, '13 teams, 3 pools',
  createDrawType(13, '13 teams, 4 pools',
  createDrawType(13, '13 teams, cup4 + cup4 + pool3 + return',

  createDrawType(14, '14 teams, 3 pools',
  createDrawType(14, '14 teams, 4 pools',
  createDrawType(14, '14 teams, cup4 + cup4 + cup4 + return',

  createDrawType(15, '15 teams, 3 pools',
  createDrawType(15, '15 teams, 4 pools',
  createDrawType(15, '15 teams, cup4 + cup4 + cup4 + pool3',

  createDrawType(16, '16 teams, 4 pools',
  createDrawType(16, '16 teams, cup',
  createDrawType(16, '16 teams, cup rank 2',
  createDrawType(16, '16 teams, cup rank 4',
  createDrawType(16, '16 teams, cup rank 8',
  createDrawType(16, '16 teams, cup8 + cup8',
  createDrawType(16, '16 teams, cup4 + cup4 + cup4 + cup4',

  createDrawType(17, '17 teams, 4 pools',
  createDrawType(17, '17 teams, cup4 + cup4 + cup4 + pool3 + return',
  createDrawType(17, '17 teams, cup8 + cup4 + pool3 + return',

  createDrawType(18, '18 teams, 3 pools',
  createDrawType(18, '18 teams, 4 pools',
  createDrawType(18, '18 teams, 3 pools',
  createDrawType(18, '18 teams, cup8 + cup8 + return',
  createDrawType(18, '18 teams, cup4 + cup4 + cup4 + cup4 + return',

  createDrawType(19, '19 teams, 4 pools',
  createDrawType(19, '19 teams, 5 pools',
  createDrawType(19, '19 teams, cup4 + cup4 + cup4 + cup4 + Pool3',

  createDrawType(20, '20 teams, 4 pools',
  createDrawType(20, '20 teams, 5 pools',
  createDrawType(20, '20 teams, cup4 + cup4 + cup4 + cup4 + cup4',
  createDrawType(20, '20 teams, cup8 + cup8 + cup4',

  createDrawType(21, '21 teams, 3 pools',
  createDrawType(21, '21 teams, 4 pools',
  createDrawType(21, '21 teams, 5 pools',
  createDrawType(21, '21 teams, 6 pools',
  createDrawType(21, '21 teams, cup8 + cup8 + Pool3 + return',

  createDrawType(22, '22 teams, 4 pools',
  createDrawType(22, '22 teams, 5 pools',
  createDrawType(22, '22 teams, 6 pools',
  createDrawType(22, '22 teams, cup8 + cup8 + cup4 + return',

  createDrawType(23, '23 teams, 5 pools',
  createDrawType(23, '23 teams, 6 pools',
  createDrawType(23, '23 teams, 2 x cup8 + Pool3',

  createDrawType(24, '24 teams, 4 pools',
  createDrawType(24, '24 teams, 5 pools',
  createDrawType(24, '24 teams, 6 pools',
  createDrawType(24, '24 teams, 3 x cup8',

  createDrawType(25, '25 teams, 4 pools',
  createDrawType(25, '25 teams, 5 pools',
  createDrawType(25, '25 teams, 6 pools',
  createDrawType(25, '25 teams, 2 x cup8 + cup4 + Pool3 + return',

  createDrawType(26, '26 teams, 5 pools',
  createDrawType(26, '26 teams, 6 pools',
  createDrawType(26, '26 teams, 3 x cup8 + return',

  createDrawType(27, '27 teams, 5 pools',
  createDrawType(27, '27 teams, 6 pools',
  createDrawType(27, '27 teams, 3 x cup8 + Pool3',
  createDrawType(27, '27 teams, 6 x cup4 + Pool3',

  createDrawType(28, '28 teams, 5 pools',
  createDrawType(28, '28 teams, 6 pools',
  createDrawType(28, '28 teams, 7 pools',

  createDrawType(29, '29 teams, 5 pools',
  createDrawType(29, '29 teams, 6 pools',
  createDrawType(29, '29 teams, 7 pools',
  createDrawType(29, '29 teams, 8 pools',

  createDrawType(30, '30 teams, 5 pools',
  createDrawType(30, '30 teams, 6 pools',
  createDrawType(30, '30 teams, 7 pools',
  createDrawType(30, '30 teams, 8 pools',

  createDrawType(31, '31 teams, 6 pools',
  createDrawType(31, '31 teams, 7 pools',
  createDrawType(31, '31 teams, 8 pools',

  createDrawType(32, '32 teams, 6 pools',
  createDrawType(32, '32 teams, 7 pools',
  createDrawType(32, '32 teams, 8 pools',
  createDrawType(32, '32 teams, cup rank 32',
  createDrawType(32, '32 teams, cup rank 2',
  createDrawType(32, '32 teams, cup rank 4',
  createDrawType(32, '32 teams, cup rank 8',
  createDrawType(32, '32 teams, cup rank 16',
*/
];

/**
 * Compute a flag indicating if a group requires Point calculation config.
 * @param groupType a group type
 * @returns a boolean value indicating if a group requires Point calculation config.
 */
function requirePointCalculationConfig(groupType: GroupType): boolean {
  return groupType === 'POOL'
    || groupType === 'POOL_RET'
    || groupType === 'POOL_3'
    || groupType === '2_WINS'
    || groupType === '3_WINS'
    || groupType === '4_WINS'
    || groupType === '5_WINS'
    ;
}

/**
 * Create a DrawType
 * @param nbTeam the number of team
 * @param drawName the name of the draw
 * @param groups the groups composing the draw type.
 * @returns a new DrawType
 */
function createDrawType(nbTeam: number, drawName: string, ...groups: DrawTypeSubGroup[]): DrawType {
  return {
    nbTeam, 
    drawName, 
    groups,
    requirePointCalculationConfig: groups.map(g => requirePointCalculationConfig(g.groupType)).reduce((a,b)=> a||b, false),
    nbGames: groups.map(g => g.nbGames).reduce((a,b)=> a+b, 0), 
    nbGroup: groups.length
  };
}

/**
 * Create a Sub Group of a Draw Type
 * @param position is position of the Sub group inside the draw type
 * @param nbTeams the number of teams
 * @param groupType the type of sub group
 * @param nbGames the number of game in this sub group
 * @returns a new Sub Group
 */
function createDrawTypeGroup(position: number, nbTeams: number, groupType: GroupType, nbGames: number): DrawTypeSubGroup {
  return { position, nbTeams, groupType, nbGames };
}

/** List of group name */
export const GroupNames: GroupName[] = [
  { position: 0, neutralName: 'A', rankedName: 'Cup'},
  { position: 1, neutralName: 'B', rankedName: 'Plate'},
  { position: 2, neutralName: 'C', rankedName: 'Bowl'},
  { position: 3, neutralName: 'D', rankedName: 'Shield'},
  { position: 4, neutralName: 'E', rankedName: 'Spoon'},
  { position: 5, neutralName: 'F', rankedName: 'Saucer'}
]

/** Define different group names based on the position */
interface GroupName {
  /** Position of the group, 0 based */
  position: number;
  /** Neutral name of group. Does not mean a rank/position */
  neutralName: string;
  /** Name indicating a level/rank */
  rankedName: string;
}

/** 
 * Number of game based on the number of team  
 * NB_GAMES_POOL[4] => 6 : With a pool of 4 teams, there are 6 games.
 * Number of games is defined up to 10 teams.
 */
export const NB_GAMES_POOL= [0, 0, 1, 3, 6, 10, 15, 21, 28, 36, 45];

/** 
 * Defines the list of pool games according to the number of teams
 * GamePoolOptions[3] is an array of GamePool
 */
export const GamePoolOptions: GamePool[][] = [
  [], // 0 team => 0 game
  [], // 1 team => 0 game
  [ // 2 teams
    { gameNb: 1, round: 1, teamHome: 1, teamAway: 2, isReturn: false },
    { gameNb: 2, round: 2, teamHome: 2, teamAway: 1, isReturn: true },
  ],
  [ // 3 teams
    { gameNb: 1, round: 1, teamHome: 1, teamAway: 2, isReturn: false },
    { gameNb: 2, round: 1, teamHome: 1, teamAway: 3, isReturn: false },
    { gameNb: 3, round: 1, teamHome: 2, teamAway: 3, isReturn: false },
    { gameNb: 4, round: 2, teamHome: 2, teamAway: 1, isReturn: true },
    { gameNb: 5, round: 2, teamHome: 3, teamAway: 1, isReturn: true },
    { gameNb: 6, round: 2, teamHome: 3, teamAway: 2, isReturn: true },
  ],
  [ // 4 teams
    { gameNb: 1, round: 1, teamHome: 1, teamAway: 2, isReturn: false },
    { gameNb: 2, round: 1, teamHome: 3, teamAway: 4, isReturn: false },
    { gameNb: 3, round: 2, teamHome: 1, teamAway: 3, isReturn: false },
    { gameNb: 4, round: 2, teamHome: 2, teamAway: 4, isReturn: false },
    { gameNb: 5, round: 2, teamHome: 1, teamAway: 4, isReturn: false },
    { gameNb: 6, round: 2, teamHome: 2, teamAway: 3, isReturn: false },
    { gameNb: 7,  round: 1, teamHome: 1, teamAway: 2, isReturn: true },
    { gameNb: 8,  round: 1, teamHome: 3, teamAway: 4, isReturn: true },
    { gameNb: 9,  round: 2, teamHome: 1, teamAway: 3, isReturn: true },
    { gameNb: 10, round: 2, teamHome: 2, teamAway: 4, isReturn: true },
    { gameNb: 11, round: 2, teamHome: 1, teamAway: 4, isReturn: true },
    { gameNb: 12, round: 2, teamHome: 2, teamAway: 3, isReturn: true },
  ],
  [ // 5 teams
    { gameNb: 1, round: 1, teamHome: 1, teamAway: 2, isReturn: false },
    { gameNb: 2, round: 1, teamHome: 3, teamAway: 4, isReturn: false },
    { gameNb: 3, round: 2, teamHome: 1, teamAway: 5, isReturn: false },
    { gameNb: 4, round: 2, teamHome: 2, teamAway: 4, isReturn: false },
    { gameNb: 5, round: 3, teamHome: 3, teamAway: 5, isReturn: false },
    { gameNb: 6, round: 3, teamHome: 1, teamAway: 4, isReturn: false },
    { gameNb: 7, round: 4, teamHome: 2, teamAway: 3, isReturn: false },
    { gameNb: 8, round: 4, teamHome: 4, teamAway: 5, isReturn: false },
    { gameNb: 9, round: 5, teamHome: 1, teamAway: 3, isReturn: false },
    { gameNb: 10, round: 5, teamHome: 2, teamAway: 5, isReturn: false },

    { gameNb: 11, round: 6, teamHome: 2, teamAway: 1, isReturn: true },
    { gameNb: 12, round: 6, teamHome: 4, teamAway: 3, isReturn: true },
    { gameNb: 13, round: 7, teamHome: 5, teamAway: 1, isReturn: true },
    { gameNb: 14, round: 7, teamHome: 4, teamAway: 2, isReturn: true },
    { gameNb: 15, round: 8, teamHome: 5, teamAway: 3, isReturn: true },
    { gameNb: 16, round: 8, teamHome: 4, teamAway: 1, isReturn: true },
    { gameNb: 17, round: 9, teamHome: 3, teamAway: 2, isReturn: true },
    { gameNb: 18, round: 9, teamHome: 5, teamAway: 4, isReturn: true },
    { gameNb: 19, round: 10, teamHome: 3, teamAway: 1, isReturn: true },
    { gameNb: 20, round: 10, teamHome: 5, teamAway: 2, isReturn: true },
  ],
  [ // TODO 6 teams
    { gameNb: 1, round: 1, teamHome: 1, teamAway: 2, isReturn: false },
    { gameNb: 2, round: 1, teamHome: 3, teamAway: 6, isReturn: false },
    { gameNb: 3, round: 1, teamHome: 4, teamAway: 5, isReturn: false },

    { gameNb: 4, round: 2, teamHome: 2, teamAway: 6, isReturn: false },
    { gameNb: 5, round: 2, teamHome: 1, teamAway: 4, isReturn: false },
    { gameNb: 6, round: 2, teamHome: 5, teamAway: 6, isReturn: false },

    { gameNb: 7, round: 3, teamHome: 2, teamAway: 3, isReturn: false },
    { gameNb: 8, round: 3, teamHome: 1, teamAway: 5, isReturn: false },
    { gameNb: 9, round: 3, teamHome: 4, teamAway: 6, isReturn: false },

    { gameNb: 10, round: 4, teamHome: 2, teamAway: 5, isReturn: false },
    { gameNb: 11, round: 4, teamHome: 1, teamAway: 3, isReturn: false },
    { gameNb: 12, round: 4, teamHome: 2, teamAway: 4, isReturn: false },

    { gameNb: 13, round: 5, teamHome: 3, teamAway: 5, isReturn: false },
    { gameNb: 14, round: 5, teamHome: 1, teamAway: 6, isReturn: false },
    { gameNb: 15, round: 5, teamHome: 3, teamAway: 4, isReturn: false },


    { gameNb: 16, round: 1, teamHome: 2, teamAway: 1, isReturn: true },
    { gameNb: 17, round: 1, teamHome: 6, teamAway: 3, isReturn: true },
    { gameNb: 18, round: 1, teamHome: 5, teamAway: 4, isReturn: true },
    
    { gameNb: 19, round: 2, teamHome: 6, teamAway: 2, isReturn: true },
    { gameNb: 20, round: 2, teamHome: 4, teamAway: 1, isReturn: true },
    { gameNb: 21, round: 2, teamHome: 6, teamAway: 5, isReturn: true },
    
    { gameNb: 22, round: 3, teamHome: 3, teamAway: 2, isReturn: true },
    { gameNb: 23, round: 3, teamHome: 5, teamAway: 1, isReturn: true },
    { gameNb: 24, round: 3, teamHome: 6, teamAway: 4, isReturn: true },
    
    { gameNb: 25, round: 4, teamHome: 5, teamAway: 2, isReturn: true },
    { gameNb: 26, round: 4, teamHome: 3, teamAway: 1, isReturn: true },
    { gameNb: 27, round: 4, teamHome: 4, teamAway: 2, isReturn: true },
    
    { gameNb: 28, round: 5, teamHome: 5, teamAway: 3, isReturn: true },
    { gameNb: 29, round: 5, teamHome: 6, teamAway: 1, isReturn: true },
    { gameNb: 30, round: 5, teamHome: 4, teamAway: 3, isReturn: true },
  ],

  [ // 7 teams
    { gameNb: 1, round: 1, teamHome: 5, teamAway: 7, isReturn: false },
    { gameNb: 2, round: 1, teamHome: 1, teamAway: 2, isReturn: false },
    { gameNb: 3, round: 1, teamHome: 3, teamAway: 4, isReturn: false },

    { gameNb: 4, round: 2, teamHome: 6, teamAway: 5, isReturn: false },
    { gameNb: 5, round: 2, teamHome: 7, teamAway: 1, isReturn: false },
    { gameNb: 6, round: 2, teamHome: 2, teamAway: 3, isReturn: false },

    { gameNb: 7, round: 3, teamHome: 4, teamAway: 5, isReturn: false },
    { gameNb: 8, round: 3, teamHome: 1, teamAway: 3, isReturn: false },
    { gameNb: 9, round: 3, teamHome: 6, teamAway: 2, isReturn: false },

    { gameNb: 10, round: 4, teamHome: 4, teamAway: 7, isReturn: false },
    { gameNb: 11, round: 4, teamHome: 1, teamAway: 5, isReturn: false },
    { gameNb: 12, round: 4, teamHome: 6, teamAway: 3, isReturn: false },

    { gameNb: 13, round: 5, teamHome: 2, teamAway: 7, isReturn: false },
    { gameNb: 14, round: 5, teamHome: 4, teamAway: 6, isReturn: false },
    { gameNb: 15, round: 5, teamHome: 2, teamAway: 5, isReturn: false },

    { gameNb: 16, round: 6, teamHome: 3, teamAway: 7, isReturn: false },
    { gameNb: 17, round: 6, teamHome: 1, teamAway: 6, isReturn: false },
    { gameNb: 18, round: 6, teamHome: 2, teamAway: 4, isReturn: false },

    { gameNb: 19, round: 7, teamHome: 3, teamAway: 5, isReturn: false },
    { gameNb: 20, round: 7, teamHome: 6, teamAway: 7, isReturn: false },
    { gameNb: 21, round: 7, teamHome: 1, teamAway: 4, isReturn: false },


    { gameNb: 22, round: 8, teamHome: 7, teamAway: 5, isReturn: true },
    { gameNb: 23, round: 8, teamHome: 2, teamAway: 1, isReturn: true },
    { gameNb: 24, round: 8, teamHome: 4, teamAway: 3, isReturn: true },

    { gameNb: 25, round: 9, teamHome: 5, teamAway: 6, isReturn: true },
    { gameNb: 26, round: 9, teamHome: 1, teamAway: 7, isReturn: true },
    { gameNb: 27, round: 9, teamHome: 3, teamAway: 2, isReturn: true },

    { gameNb: 28, round: 10, teamHome: 5, teamAway: 4, isReturn: true },
    { gameNb: 29, round: 10, teamHome: 3, teamAway: 1, isReturn: true },
    { gameNb: 30, round: 10, teamHome: 2, teamAway: 6, isReturn: true },

    { gameNb: 31, round: 11, teamHome: 7, teamAway: 4, isReturn: true },
    { gameNb: 32, round: 11, teamHome: 5, teamAway: 1, isReturn: true },
    { gameNb: 33, round: 11, teamHome: 3, teamAway: 6, isReturn: true },

    { gameNb: 34, round: 12, teamHome: 7, teamAway: 2, isReturn: true },
    { gameNb: 35, round: 12, teamHome: 6, teamAway: 4, isReturn: true },
    { gameNb: 36, round: 12, teamHome: 5, teamAway: 2, isReturn: true },

    { gameNb: 37, round: 13, teamHome: 7, teamAway: 3, isReturn: true },
    { gameNb: 38, round: 13, teamHome: 6, teamAway: 1, isReturn: true },
    { gameNb: 39, round: 13, teamHome: 4, teamAway: 2, isReturn: true },

    { gameNb: 40, round: 14, teamHome: 5, teamAway: 3, isReturn: true },
    { gameNb: 41, round: 14, teamHome: 7, teamAway: 6, isReturn: true },
    { gameNb: 42, round: 14, teamHome: 4, teamAway: 1, isReturn: true },
  ],

  [ // 8 teams
    { gameNb: 1,  round: 1, teamHome: 1, teamAway: 2, isReturn: false },
    { gameNb: 2,  round: 1, teamHome: 3, teamAway: 4, isReturn: false },
    { gameNb: 3,  round: 1, teamHome: 5, teamAway: 6, isReturn: false },
    { gameNb: 4,  round: 1, teamHome: 7, teamAway: 8, isReturn: false },
 
    { gameNb: 5,  round: 2, teamHome: 1, teamAway: 3, isReturn: false },
    { gameNb: 6,  round: 2, teamHome: 2, teamAway: 4, isReturn: false },
    { gameNb: 7,  round: 2, teamHome: 5, teamAway: 7, isReturn: false },
    { gameNb: 8,  round: 2, teamHome: 6, teamAway: 8, isReturn: false },

    { gameNb: 9,  round: 3, teamHome: 1, teamAway: 4, isReturn: false },
    { gameNb: 10, round: 3, teamHome: 2, teamAway: 3, isReturn: false },
    { gameNb: 11, round: 3, teamHome: 6, teamAway: 7, isReturn: false },
    { gameNb: 12, round: 3, teamHome: 5, teamAway: 8, isReturn: false },

    { gameNb: 13, round: 4, teamHome: 1, teamAway: 5, isReturn: false },
    { gameNb: 14, round: 4, teamHome: 2, teamAway: 6, isReturn: false },
    { gameNb: 15, round: 4, teamHome: 3, teamAway: 8, isReturn: false },
    { gameNb: 16, round: 4, teamHome: 4, teamAway: 7, isReturn: false },

    { gameNb: 17, round: 5, teamHome: 1, teamAway: 6, isReturn: false },
    { gameNb: 18, round: 5, teamHome: 2, teamAway: 5, isReturn: false },
    { gameNb: 19, round: 5, teamHome: 4, teamAway: 8, isReturn: false },
    { gameNb: 20, round: 5, teamHome: 3, teamAway: 7, isReturn: false },

    { gameNb: 21, round: 6, teamHome: 1, teamAway: 7, isReturn: false },
    { gameNb: 22, round: 6, teamHome: 2, teamAway: 8, isReturn: false },
    { gameNb: 23, round: 6, teamHome: 3, teamAway: 5, isReturn: false },
    { gameNb: 24, round: 6, teamHome: 4, teamAway: 6, isReturn: false },

    { gameNb: 25, round: 7, teamHome: 1, teamAway: 8, isReturn: false },
    { gameNb: 26, round: 7, teamHome: 2, teamAway: 7, isReturn: false },
    { gameNb: 27, round: 7, teamHome: 4, teamAway: 5, isReturn: false },
    { gameNb: 28, round: 7, teamHome: 3, teamAway: 6, isReturn: false },


    { gameNb: 29, round: 8, teamHome: 2, teamAway: 1, isReturn: true },
    { gameNb: 30, round: 8, teamHome: 4, teamAway: 3, isReturn: true },
    { gameNb: 31, round: 8, teamHome: 6, teamAway: 5, isReturn: true },
    { gameNb: 32, round: 8, teamHome: 8, teamAway: 7, isReturn: true },
 
    { gameNb: 33, round: 9, teamHome: 3, teamAway: 1, isReturn: true },
    { gameNb: 34, round: 9, teamHome: 4, teamAway: 2, isReturn: true },
    { gameNb: 35, round: 9, teamHome: 7, teamAway: 5, isReturn: true },
    { gameNb: 36, round: 9, teamHome: 8, teamAway: 6, isReturn: true },

    { gameNb: 37, round: 10, teamHome: 4, teamAway: 1, isReturn: true },
    { gameNb: 38, round: 10, teamHome: 3, teamAway: 2, isReturn: true },
    { gameNb: 39, round: 10, teamHome: 7, teamAway: 6, isReturn: true },
    { gameNb: 40, round: 10, teamHome: 8, teamAway: 5, isReturn: true },

    { gameNb: 41, round: 11, teamHome: 5, teamAway: 1, isReturn: true },
    { gameNb: 42, round: 11, teamHome: 6, teamAway: 2, isReturn: true },
    { gameNb: 43, round: 11, teamHome: 8, teamAway: 3, isReturn: true },
    { gameNb: 44, round: 11, teamHome: 7, teamAway: 4, isReturn: true },

    { gameNb: 45, round: 12, teamHome: 6, teamAway: 1, isReturn: true },
    { gameNb: 46, round: 12, teamHome: 5, teamAway: 2, isReturn: true },
    { gameNb: 47, round: 12, teamHome: 8, teamAway: 4, isReturn: true },
    { gameNb: 48, round: 12, teamHome: 7, teamAway: 3, isReturn: true },

    { gameNb: 49, round: 13, teamHome: 7, teamAway: 1, isReturn: true },
    { gameNb: 50, round: 13, teamHome: 8, teamAway: 2, isReturn: true },
    { gameNb: 51, round: 13, teamHome: 5, teamAway: 3, isReturn: true },
    { gameNb: 52, round: 13, teamHome: 6, teamAway: 4, isReturn: true },

    { gameNb: 53, round: 14, teamHome: 8, teamAway: 1, isReturn: true },
    { gameNb: 54, round: 14, teamHome: 7, teamAway: 2, isReturn: true },
    { gameNb: 55, round: 14, teamHome: 5, teamAway: 4, isReturn: true },
    { gameNb: 56, round: 14, teamHome: 6, teamAway: 3, isReturn: true },
  ],
];

/** Define a game in pool draw. */
export interface GamePool {
  /** Number of the game */
  gameNb: number;
  /** Round of the game */
  round: number;
  /** Numbef of the home team to play (start from 1) */
  teamHome: number;
  /** Numbef of the away team to play (start from 1) */
  teamAway: number;
  /** Indicates if the game is the 2nd game between both teams */
  isReturn: boolean;
}
