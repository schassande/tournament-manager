import { Injectable } from "@angular/core";
import { DivisionDraw, GamePoolOptions, Group, SpecificDataPool, TeamPoint, Step, DrawTypeSubGroup } from "@tournament-manager/persistent-data-model";
import { DrawAbstractService, GroupAllocParams } from "./draw-abstract.service";

@Injectable({ providedIn: 'root' })
export class DrawRankingService extends DrawAbstractService {

  /**
   * Allocates games for a group Type SEMI*: 1vs2,3vs4
   * @param step is the Step object
   * @param group is the Group object containing teams and where the game must be allocated
   * @param groupDesc is the descriptor of the group (from DrawType)
   * @param whatPrefix is the prefix to use for naming the 'what' of a game
   */
  public allocateGroupGames(groupAllocParams : GroupAllocParams) {
    const { draw, step, group, whatPrefix} =  groupAllocParams;
    group.games.push({
      homeTeam: this.getTeamReference(1, step, draw),
      awayTeam: this.getTeamReference(2, step, draw),
      id: crypto.randomUUID(),
      resultRequired: true,
      round: 1,
      status: 'DRAWN',
      what: whatPrefix + '-1vs2',
    });
    group.games.push({
      homeTeam: this.getTeamReference(3, step, draw),
      awayTeam: this.getTeamReference(4, step, draw),
      id: crypto.randomUUID(),
      resultRequired: true,
      round: 1,
      status: 'DRAWN',
      what: whatPrefix + '-3vs4',
    });
  }
}