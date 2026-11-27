import { Injectable } from "@angular/core";
import { DivisionDraw, GamePoolOptions, Group, SpecificDataPool, TeamPoint, Step, DrawTypeSubGroup } from "@tournament-manager/persistent-data-model";
import { DrawAbstractService, GroupAllocParams } from "./draw-abstract.service";

@Injectable({ providedIn: 'root' })
export class DrawWinsService extends DrawAbstractService {

  /**
   * Allocates games for a group Type WINS*
   * @param step is the Step object
   * @param group is the Group object containing teams and where the game must be allocated
   * @param groupDesc is the descriptor of the group (from DrawType)
   * @param whatPrefix is the prefix to use for naming the 'what' of a game
   */
  public allocateGroupGames(groupAllocParams : GroupAllocParams) {
    const { draw, step, group, groupDesc, whatPrefix} =  groupAllocParams;
    for (let gameIdx = 0; gameIdx < groupDesc.nbGames; gameIdx++) {
      group.games.push({
        homeTeam: this.getTeamReference(gameIdx % 2 === 0 ? 1 : 2, step, draw),
        awayTeam: this.getTeamReference(gameIdx % 2 === 0 ? 2 : 1 , step, draw),
        id: crypto.randomUUID(),
        resultRequired: false,
        round: gameIdx + 1,
        status: 'DRAWN',
        what: whatPrefix + '-W' + (gameIdx + 1),
      });
    }
  }
}