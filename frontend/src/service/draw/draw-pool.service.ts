import { Injectable } from "@angular/core";
import { DivisionDraw, GamePoolOptions, Group, SpecificDataPool, TeamPoint, Step } from "@tournament-manager/persistent-data-model";
import { DrawAbstractService, GroupAllocParams } from "./draw-abstract.service";

@Injectable({ providedIn: 'root' })
export class DrawPoolService extends DrawAbstractService {

  /**
   * Allocates games for a group Type POOL*
   * @param step is the Step object
   * @param group is the Group object containing teams and where the game must be allocated
   * @param groupDesc is the descriptor of the group (from DrawType)
   * @param whatPrefix is the prefix to use for naming the 'what' of a game
   */
  public allocateGroupGames(groupAllocParams : GroupAllocParams) {
    const { draw, step, group, whatPrefix} =  groupAllocParams;
    const nbGamePerCouple = groupAllocParams.nbGamePerCouple!
    const offset = step.groups.filter((g, idx) => idx < group.position).map(g => g.teams.length).reduce((a,b) => a+b, 0);
    // console.log('allocateGroupGamesPool(', group.name, whatPrefix, nbGamePerCouple, group.teams.length + ' teams');
    for (let ret = 1; ret <= nbGamePerCouple; ret++) {
      GamePoolOptions[group.teams.length]
        .filter((gpo) => (ret % 2 === 1 && !gpo.isReturn) || (ret % 2 === 0 && gpo.isReturn))
        .forEach((gpo) => {
          group.games.push({
            homeTeam: this.getTeamReference(offset + gpo.teamHome, step, draw),
            awayTeam: this.getTeamReference(offset + gpo.teamAway, step, draw),
            id: crypto.randomUUID(),
            resultRequired: false,
            round: gpo.round,
            status: 'DRAWN',
            what: whatPrefix + '-R' + gpo.round + '-#' + gpo.gameNb
          });
        });
    }
    this.getOrCreateTeamPoints(group);
  }

  public getOrCreateTeamPoints(group: Group|undefined): TeamPoint[] {
    if (group) {
      let poolGroup: SpecificDataPool = group.specificData as SpecificDataPool;
      poolGroup.teamsPoints = group.teams.map(teamRef => {
        return {
          team: teamRef,
          cumulatedOppositeScore: 0,
          cumulatedScore: 0,
          draw: 0,
          goalAverage: 0,
          lost: 0,
          played: 0,
          points: 0,
          rank: 1,
          win: 0
        };
      });
      return poolGroup.teamsPoints;
    } else 
      return []
  }
}