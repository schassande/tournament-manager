import { colDivisionDraw, colGame, DEFAULT_RANKING_CRITERIA, DivisionDraw, DrawGame, DrawTypeSubGroup, Game, Group, PointCalculation, RankingCriteria, SpecificDataPool, Step, TeamPoint, TeamReference } from "@tournament-manager/persistent-data-model";
import { byIdInTx, saveInTx } from "../common-persistence";
import * as admin   from 'firebase-admin';

/**
 * Updates a game's score and applies the corresponding draw changes atomically.
 *
 * @param gameId Identifier of the game to update.
 * @param homeScore Score of the home team.
 * @param awayScore Score of the away team.
 * @param finished Whether the game must be marked as finished.
 * @param firestore Firestore instance used by the transaction.
 */
export async function setGameScore(gameId: string, homeScore: number, awayScore: number, finished: boolean, firestore: admin.firestore.Firestore): Promise<void> {
  firestore.runTransaction(async tx => {
    const gameCtx: GameContext = await loadData(gameId, tx, firestore);
    await DrawManager.build(gameCtx).setGameScore(homeScore, awayScore, finished, tx, firestore);
  });
}

/**
 * Loads and validates all data required to process a game score.
 *
 * @param gameId Identifier of the game to load.
 * @param tx Active Firestore transaction.
 * @param firestore Firestore instance used to resolve document references.
 * @returns The game, its draw hierarchy, and all games in its group.
 */
async function loadData(gameId: string, tx: admin.firestore.Transaction, firestore: admin.firestore.Firestore): Promise<GameContext> {
  // load game from game Id
  const game: Game|undefined = await byIdInTx<Game>(colGame, gameId, firestore, tx);
  if (!game) throw new Error('Internal error: No game found with the id: '+gameId);
  // control the game
  if (!game.scheduleInfo)
    throw new Error('Internal error: No scheduleInfo found for the game: '+game.id);
  if (!game.scheduleInfo?.divisionDrawId) 
    throw new Error('Internal error: No divisionDrawId found for the game: '+game.id);

  const draw: DivisionDraw|undefined = await byIdInTx<DivisionDraw>(colDivisionDraw, game.scheduleInfo!.divisionDrawId!, firestore, tx);
  if (!draw) throw new Error('Internal error: No draw found with the id: '+game.scheduleInfo!.divisionDrawId+' for the game: '+game.id);

  const step: Step|undefined = draw.steps.find(step => step.id === game.scheduleInfo!.stepId);
  if (!step) throw new Error('Internal error: No step found with the id: '+game.scheduleInfo!.stepId+' for the game: '+game.id);

  const group: Group|undefined = step.groups.find(group => group.id === game.scheduleInfo?.groupId);
  if (!group) throw new Error('Internal error: No group found with the id: '+game.scheduleInfo!.groupId+' for the game: '+game.id);

  const drawGame: DrawGame|undefined = group.games.find(drawGame => drawGame.id === game.scheduleInfo!.drawGameId);
  if (!drawGame) throw new Error('Internal error: No DrawGame found with the id: '+game.scheduleInfo!.drawGameId+' for the game: '+game.id);

  // Load other games of the group
  const otherGroupGameIds: string[] = group.games.map(drawGame => drawGame.gameId).filter(gid => gid && gid !== game.id) as string[];
  const groupGames: Game[] = (await Promise.all(otherGroupGameIds
    .map(async gid => await byIdInTx<Game>(colGame, gid, firestore, tx))))
    .filter(g => g) as Game[];
  if (otherGroupGameIds.length !== groupGames.length) 
    throw new Error('Internal error: '+(otherGroupGameIds.length - groupGames.length)+' missing Games in the group '+game.scheduleInfo!.groupId);
  groupGames.push(game);

  return {game, draw, step, group, drawGame, groupGames};
}

/** Data loaded from Firestore and required by a draw manager. */
interface GameContext {
  game: Game;
  draw: DivisionDraw;
  step: Step;
  group: Group;
  drawGame: DrawGame; 
  groupGames: Game[];
}

/** Base draw manager implementing score updates shared by all draw types. */
class DrawManager {
  game: Game; 
  draw: DivisionDraw;
  step: Step;
  group: Group;
  drawGame: DrawGame; 
  groupGames: Game[];
  drawchanged = false;
  gamesToSave: Game[] = [];

  /**
   * Creates the draw manager matching the current group's type.
   *
   * @param gameCtx Game and draw data loaded for the transaction.
   * @returns A draw manager specialized for the group type.
   */
  static build(gameCtx: GameContext): DrawManager {
    const { step, group } = gameCtx;
    const groupDesc: DrawTypeSubGroup = step.drawType.groups[group.position];
    switch (groupDesc.groupType) {
      case 'NONE': 
        return new DrawManager(gameCtx);
      case '2_WINS': 
      case '3_WINS': 
      case '4_WINS': 
      case '5_WINS': 
        return new WinsDrawManager(gameCtx);
      case 'POOL': 
      case 'POOL_RET':
      case 'POOL_3': 
        return new PoolDrawManager(gameCtx);
      case 'SEMI': 
      case 'RANKING': 
        return new RankingDrawManager(gameCtx);
      default:
        if (groupDesc.groupType.startsWith('CUP')) {
          return new CupDrawManager(gameCtx);
        }
        throw new Error('GroupType is not supported yet: ' + groupDesc.groupType);
    }
  }

  /** Creates a manager for a loaded game context. */
  constructor(gameCtx: GameContext) {
    this.game = gameCtx.game;
    this.draw = gameCtx.draw;
    this.step = gameCtx.step;
    this.group = gameCtx.group;
    this.drawGame = gameCtx.drawGame;
    this.groupGames = gameCtx.groupGames;
  }

  /**
   * Updates the game and persists all derived draw changes in the transaction.
   *
   * @param homeScore Score of the home team.
   * @param awayScore Score of the away team.
   * @param finished Whether the game must be marked as finished.
   * @param tx Active Firestore transaction.
   * @param firestore Firestore instance used to persist the changes.
   */
  public async setGameScore(
    homeTeamScore: number, 
    awayTeamScore: number, 
    finished: boolean, 
    tx: admin.firestore.Transaction,
    firestore: admin.firestore.Firestore): Promise<void> {

    if (this.game.resultRequired && awayTeamScore !== homeTeamScore)
      throw new Error('Error: score is a draw whereas a result is required on game with id '+ this.game.id);

    // update score
    this.game.score = {homeTeamScore, awayTeamScore};
    this.gamesToSave.push(this.game);

    
    if (this.updateDrawGameStatus(this.drawGame, finished)) {
      // The status of DrawGame changed
      await this.updateStepData();
      if (finished) {
        if (this.isGroupFinished(this.group)) {
          // All games of the group are finished
          this.finishGroup();
          if (this.isStepGroupsFinished(this.step)) {
            // All groups of the step are finished => Move step status to FINISHED
            this.step.status = 'FINISHED';
            this.drawchanged = true;
          }
        }
      } else {
        this.unfinishGroup();
        if (this.step.status === 'FINISHED') {
          // the step was finished => come back to RUNNING status
          this.step.status = 'RUNNING';
          this.drawchanged = true;
        }
      }
      if (this.drawchanged) {
        await saveInTx<DivisionDraw>(colDivisionDraw, this.draw, firestore, tx);
      }
    }
    for (const currentGame of this.gamesToSave) {
      await saveInTx<Game>(colGame, currentGame, firestore, tx);
    }
  }
  
  /** Updates draw-type-specific data derived from the new score. */
  public async updateStepData(): Promise<void> {
  }

  /** Applies draw-type-specific changes after all group games are finished. */
  public finishGroup() {
  }

  /** Reverts draw-type-specific completion changes for the group. */
  public unfinishGroup() {
  }

  /** Determines whether every playable game in a group is complete. */
  private isGroupFinished(group: Group): boolean {
    return group.games.filter(drawGame => drawGame.status !== 'FINISHED' && drawGame.status !== 'CANCELED').length === 0;
  }
  /** Determines whether every group in a step is complete. */
  private isStepGroupsFinished(step: Step): boolean {
    return step.groups.map(group => this.isGroupFinished(group)).reduce((a,b)=> a && b, true)
  }

  /**
   * Updates a draw game status according to its completion state.
   * @return true is the status has been changed
   * @throws Error when the requested status transition is not allowed.
   */
  private updateDrawGameStatus(drawGame: DrawGame, finished: boolean): boolean {
    if (finished) {
      switch(drawGame.status) {
        case 'FINISHED': // Already finish => nothing to do
          return false;

        case 'PLANIFIED':
        case 'PLAYING':
        case 'READY_TO_PLAY':
          drawGame.status = 'FINISHED';
          this.drawchanged = true;
          return true;

        case 'CANCELED': 
        case 'DRAWN':
        default:
          throw new Error('Internal error: Locking a game with the status '+drawGame.status+' is forbiden. GameId:' + drawGame.gameId);
      }
    } else {
      switch(drawGame.status) {
        case 'FINISHED': 
          drawGame.status = 'PLAYING';
          this.drawchanged = true;
          return true;

        case 'PLANIFIED': 
        case 'PLAYING':
        case 'READY_TO_PLAY':
          // Already ok => nothing to do
          return false;

        case 'CANCELED': 
        case 'DRAWN':
        default:
          throw new Error('Internal error: Unlocking a game with the status '+drawGame.status+' is forbiden. GameId:' + drawGame.gameId);
      }
    }
  }
  private setTeamIdIfDiff(teamRef: TeamReference, teamId: string) {
    if (teamRef.teamId !== teamId) {
      teamRef.teamId = teamId;
      this.drawchanged = true;
    }
  }
  /**
   * Updates a team reference from the winner or loser of a source game.
   * @param teamRef Team reference to update.
   * @param source Source draw game and persisted game.
   * @returns `true` when the referenced team changed.
   */
  protected updateTeamRefFromGame(teamRef: TeamReference, source: {drawGame: DrawGame, game: Game}): boolean {
    if (teamRef.drawGameId === source.drawGame.id 
      && (teamRef.teamSelectorType === 'WINNER_OF' || teamRef.teamSelectorType === 'LOSER_OF')) {

      if (source.drawGame.status === 'FINISHED') {
        if (teamRef.teamSelectorType === 'WINNER_OF') {
          this.setTeamIdIfDiff(teamRef, 
            source.game.score!.homeTeamScore > source.game.score!.homeTeamScore 
            ? source.game.homeTeamId! : source.game.awayTeamId!);
          return true;

        } else if (teamRef.teamSelectorType === 'LOSER_OF') {
          this.setTeamIdIfDiff(teamRef, 
            source.game.score!.homeTeamScore > source.game.score!.homeTeamScore 
            ? source.game.awayTeamId! : source.game.homeTeamId!);
          return true;
        }
      }
      if (teamRef.teamId) {
        delete teamRef.teamId;
        this.drawchanged = true;
        return true;
      }
    }
    return false;
  }
  protected updateOutputTeamFromGame() {
    this.step.outputTeams.forEach(tr => this.updateTeamRefFromGame(tr, {drawGame: this.drawGame, game: this.game}));
  }
}

/** Draw manager for pool groups, including points and rankings. */
class PoolDrawManager extends DrawManager {

  /** Creates a pool draw manager for the supplied game context. */
  constructor(gameCtx: GameContext) {
    super(gameCtx);
  }

  /** Recomputes the pool standings after a score change. */
  public async updateStepData(): Promise<void> {
    const specificData: SpecificDataPool = this.group.specificData as SpecificDataPool;
    const pointCalculation = this.draw.pointCalculations.find(pc => pc.id === specificData.pointCalculationId);
    if (!pointCalculation) throw new Error('Internal error: PointCalcultation '+specificData.pointCalculationId+' of the group ' + this.step.name + '/' + this.group.name);
    this.recomputeAllPointCalculations(specificData.teamsPoints, this.groupGames, pointCalculation);
    this.computeRanks(specificData.teamsPoints, pointCalculation.rankingCriteria ?? DEFAULT_RANKING_CRITERIA);
    this.drawchanged = true;
  }

  /** Resolves group output teams when the pool is complete. */
  public finishGroup() {
      // all group games are locked, then the step is finished ==> compute the output teams;
    const specificData: SpecificDataPool = this.group.specificData as SpecificDataPool;
    this.step.outputTeams.forEach(tr => {
      if (tr.teamSelectorType === 'RANK_IN_GROUP' && tr.groupId === this.group.id) {
        tr.teamId = specificData.teamsPoints[tr.rank!-1].team.teamId;
        this.drawchanged = true;
      }
    });
  }

  /** Clears group output teams when a completed pool becomes active again. */
  public unfinishGroup() {
    this.step.outputTeams.forEach(tr => {
      if (tr.teamSelectorType === 'RANK_IN_GROUP' && tr.groupId === this.group.id) {
        delete tr.teamId;
        this.drawchanged = true;
      }
    });
  }

  /** Recomputes all team points from the current group games. */
  private recomputeAllPointCalculations(teamsPoints: TeamPoint[], groupGames: Game[], pointCalculation: PointCalculation) {
    this.resetPointCalculations(teamsPoints);
    groupGames.forEach(game => this.updateTeamPointsFromGame(teamsPoints, game, pointCalculation));
  }

  /** Resets all accumulated statistics before recomputation. */
  private resetPointCalculations(teamsPoints: TeamPoint[]) {
    teamsPoints.forEach(tp => {
      tp.cumulatedOppositeScore = 0;
      tp.cumulatedScore = 0;
      tp.draw = 0;
      tp.goalAverage = 0;
      tp.lost = 0;
      tp.played = 0;
      tp.points = 0;
      tp.rank = 0;
      tp.win = 0;
    })
  }

  /**
   * Updates the statistics of the teams involved in a game.
   *
   * @param teamsPoints List of all team statistics in the group.
   * @param game Game whose score contributes to the statistics.
   * @param pointCalculation Point configuration used to award points.
   * @returns `true` when at least one team statistic was updated.
   */
  private updateTeamPointsFromGame(teamsPoints: TeamPoint[], game: Game, pointCalculation: PointCalculation): boolean {
    let drawChanged = false;
    teamsPoints.forEach(tp => {
      if (tp.team.teamId !== game.awayTeamId && tp.team.teamId !== game.homeTeamId) return;

      tp.played++;
      tp.cumulatedOppositeScore += tp.team.teamId === game.homeTeamId ? game.score!.homeTeamScore : game.score!.awayTeamScore;
      tp.cumulatedScore += tp.team.teamId === game.homeTeamId ? game.score!.awayTeamScore : game.score!.homeTeamScore;
      tp.goalAverage = tp.cumulatedScore - tp.cumulatedOppositeScore;
      if (game.score!.awayTeamScore === game.score!.homeTeamScore) {
        tp.draw ++;
        tp.points += pointCalculation.drawPoint;
      } else {
        const winner: string = game.score!.homeTeamScore > game.score!.awayTeamScore ? game.homeTeamId! : game.awayTeamId!;
        const loser: string = game.score!.homeTeamScore < game.score!.awayTeamScore ? game.homeTeamId! : game.awayTeamId!;
        if (tp.team.teamId === winner) {
          tp.win ++;
          tp.points += pointCalculation.winPoint;
        } else if (tp.team.teamId === loser) {
          tp.lost ++;
          tp.points += pointCalculation.lostPoint;
        }
      }

      drawChanged = true;
    });
    return drawChanged;
  }

  /** Sorts team statistics and assigns their ranks. */
  private computeRanks(teamsPoints: TeamPoint[], rankingCriteria: RankingCriteria[]) {
    // Sort teamsPoints
    teamsPoints.sort((tp1, tp2) => this.compareTeamsPoints(tp1, tp2, rankingCriteria));

    // Allocation ranks
    teamsPoints[0].rank = 1;
    for (let idx = 1; idx < teamsPoints.length; idx++) {
      const compareRes = this.compareTeamsPoints(teamsPoints[idx-1], teamsPoints[idx], rankingCriteria);
      if (compareRes === 0) {
        teamsPoints[idx].rank = teamsPoints[idx-1].rank;
      } else {
        teamsPoints[idx].rank = teamsPoints[idx-1].rank + 1;
      }
    }
  }

  /**
   * Compares two team statistics using the configured criteria.
   * @param tp1 First team statistics.
   * @param tp2 Second team statistics.
   * @param rankingCriteria Ordered ranking criteria.
   * @returns A negative, zero, or positive value according to the ordering.
   */
  private compareTeamsPoints(tp1: TeamPoint, tp2: TeamPoint, rankingCriteria: RankingCriteria[]): number {
    let res = 0;
    for (let idx = 0; res === 0 && idx < rankingCriteria.length; idx++) {
      const rc = rankingCriteria[idx];
      if (rc === 'POINTS') 
        res = tp1.points - tp2.points;
      else if (rc === 'GOAL_AVERAGE') 
        res = tp1.goalAverage - tp1.goalAverage;
      else if (rc === 'WIN') 
        res = tp1.win - tp1.win;
      else if (rc === 'CUMULATED_SCORE') 
        res = tp1.cumulatedScore - tp1.cumulatedScore;
      else if (rc === 'CUMULATED_OPPOSITE_SCORE') 
        res = tp1.cumulatedOppositeScore - tp1.cumulatedOppositeScore;
    }
    return res;
  }  
}

/** Draw manager for cup groups and their dependent games. */
class CupDrawManager extends DrawManager {
  /** Creates a cup draw manager for the supplied game context. */
  constructor(gameCtx: GameContext) {
    super(gameCtx);
  }

  /** Updates dependent games after the source game's result changes. */
  public async updateStepData(): Promise<void> {
    // update the group games depending on the game result
    this.group.games.forEach(dg => {
      const currentGame = this.groupGames.find(g=> g.id === dg.gameId);
      if (!currentGame) return;

      let gameModified = false;

      if (this.updateTeamRefFromGame(dg.homeTeam, {drawGame: this.drawGame, game: this.game})) {
        currentGame.homeTeamId = dg.homeTeam.teamId;
        gameModified = true;
      }
      if (this.updateTeamRefFromGame(dg.awayTeam, {drawGame: this.drawGame, game: this.game})) {
        currentGame.awayTeamId = dg.awayTeam.teamId;
        gameModified = true;
      }
      if (gameModified) {
        this.drawchanged = true;
        this.gamesToSave.push(currentGame);
      }
    });
  }
  /** Resolves output team references when the cup group is complete. */
  public finishGroup() {
    this.updateOutputTeamFromGame();
  }

  /** Clears output team references when the cup group is reopened. */
  public unfinishGroup() {
    this.updateOutputTeamFromGame();
  }
}

/** Draw manager for groups decided by a number of wins. */
class WinsDrawManager extends DrawManager {
  nbGamesToWin: number = 0;
  teamAWins = {teamId: '', wins: 0};
  teamBWins = {teamId: '', wins: 0};

  /** Creates a wins draw manager for the supplied game context. */
  constructor(gameCtx: GameContext) {
    super(gameCtx);
  }

  /** Recomputes wins and cancels games that are no longer necessary. */
  public async updateStepData(): Promise<void> {
    this.nbGamesToWin = Math.floor(this.groupGames.length / 2) + (this.groupGames.length % 2);
    this.teamAWins = {teamId: this.group.teams[0].teamId!, wins: 0};
    this.teamBWins = {teamId: this.group.teams[1].teamId!, wins: 0};
    // Iterate over game to count the number of wins per team
    let gameIdx = 0;
    while (gameIdx < this.groupGames.length && this.teamAWins.wins < this.nbGamesToWin && this.teamAWins.wins < this.nbGamesToWin) {
      const homeWins = this.teamAWins.teamId === this.groupGames[gameIdx].homeTeamId ? this.teamAWins : this.teamBWins;
      const awayWins = this.teamAWins.teamId === this.groupGames[gameIdx].awayTeamId ? this.teamAWins : this.teamBWins;
      if (this.game.score!.homeTeamScore > this.game.score!.awayTeamScore) homeWins.wins++;
      if (this.game.score!.awayTeamScore > this.game.score!.homeTeamScore) awayWins.wins++;
      gameIdx++;
    }
    if ((this.teamAWins.wins >= this.nbGamesToWin || this.teamBWins.wins >= this.nbGamesToWin) && gameIdx < this.groupGames.length) {
      // One of both teams already reach the minimal number of wins to win globally the group
      // And the next games are useful => cancel it
      for (let i = gameIdx; i < this.groupGames.length; i++) {
        const drawGame = this.group.games.find(drawGame => drawGame.gameId === this.groupGames[i].id);
        if (drawGame && drawGame.status !== 'PLAYING' && drawGame.status !== 'FINISHED') {
          drawGame.status = 'CANCELED'
          this.drawchanged = true;
        } 
      }
    }
  }

  /** Resolves output team references when the wins group is complete. */
  public finishGroup() {
    const nbGamesToWin = Math.floor(this.group.games.length / 2) + (this.group.games.length % 2);
    // Update the Step Output Teams based on the group rank
    this.step.outputTeams.forEach(tr => {
      if (tr.teamSelectorType === 'RANK_IN_GROUP' && tr.groupId === this.group.id) {
        if (tr.rank === 1) {
          tr.teamId = this.teamAWins.wins >= nbGamesToWin ? this.teamAWins.teamId : this.teamBWins.teamId;
          this.drawchanged = true;
        } else if (tr.rank === 2) {
          tr.teamId = this.teamAWins.wins >= nbGamesToWin ? this.teamBWins.teamId : this.teamAWins.teamId;
          this.drawchanged = true;
        }
      }
    });
  }
}


/** Draw manager for ranking groups using the base behavior. */
class RankingDrawManager extends DrawManager {

  public finishGroup(): void {
    this.updateOutputTeamFromGame();
  }

  public unfinishGroup(): void {
    this.updateOutputTeamFromGame();
  }
}
