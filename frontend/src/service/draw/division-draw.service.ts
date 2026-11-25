import { Injectable, forwardRef, inject } from '@angular/core';
import {
  Division,
  DivisionDraw,
  DrawTypeSubGroup,
  GamePoolOptions,
  Group,
  SpecificDataCup,
  SpecificDataPool,
  Step,
  TeamPoint,
  TeamReference,
} from '@tournament-manager/persistent-data-model';
import { query, where } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { AbstractPersistentDataService } from '../abstract-persistent-data.service';
import { DrawCupService } from './draw-cup.service';

/** Provides persistence operations for competition draws belonging to tournaments. */
@Injectable({ providedIn: 'root' })
export class DivisionDrawService extends AbstractPersistentDataService<DivisionDraw> {
  private readonly drawCupService = inject(DrawCupService);

  /** Returns the Firestore collection containing division draw definitions. */
  protected override getCollectionName(): string {
    return 'division-draw';
  }

  /** Normalizes the legacy persisted step status while loading a draw. */
  protected override adjustItemOnLoad(item: DivisionDraw): DivisionDraw {
    item.steps.forEach((step) => {
      if ((step.status as string) === 'DRAWED') step.status = 'DRAWN';
      step.ouputTeamRankingStrategy ??= 'GROUP_ORDER';
    });
    return item;
  }

  /** Loads all draw definitions for one tournament. */
  public byTournament(tournamentId: string): Observable<DivisionDraw[]> {
    return this.query(query(this.itemsCollection(), where('tournamentId', '==', tournamentId)));
  }

  /**
   * It creates the Input teams from the previous step or the Draw. It creates the drawgame based on the drawtype
   * @param divisionDraw
   * @param stepPosition
   */
  public drawStep(divisionDraw: DivisionDraw, division: Division, stepPosition: number) {
    const step = divisionDraw.steps[stepPosition];
    if (!step || step.status !== 'DRAFT') {
      throw new Error('Only a draft step can be drawn.');
    }
    // allocate input team from the previous step or the Draw
    if (stepPosition > 0) {
      step.inputTeams = divisionDraw.steps[stepPosition - 1].outputTeams;
    }
    // step.inputTeams.forEach(it => 
    //  console.log('Step input team', it.rank,':', it.teamId, division.teams.find(t => t.id === it.teamId)?.shortName));

    // Put teams in groups
    this.distributeTeamsInGroups(step);

    // allocate games
    this.allocateGames(divisionDraw, step, division.shortName);

    this.allocateOutputTeams(step);

    if (step.status === 'DRAFT') step.status = 'DRAWN';
  }

  //////////////////////////////////////////////////////////////////////////
  // TEAMS DISTRIBUTION MEHTODS
  //////////////////////////////////////////////////////////////////////////

  /**
   * Distribute the input teams into the groups of a step
   * @param step is a Step Object
   */
  private distributeTeamsInGroups(step: Step) {
    if (step.inputTeams.length < step.drawType.nbTeam) {
      throw new Error(
        'Not enough input teams in this step for this draw: ' +
          step.inputTeams.length +
          ' teams, drawType: ' +
          step.drawType.drawName,
      );
    }
    // clean teams from the step
    step.groups.forEach(g => g.teams = []);
    step.outputTeams = [];

    // the distribution of the teams depends on the strategy
    if (step.groups.length === 1 || step.spreadTeamsAlgo === 'Best teams together') {
      let idx = 0;
      step.drawType.groups.forEach((group, groupIdx) => {
        const next = Math.min(idx + group.nbTeams, step.inputTeams.length);
        if (idx < step.inputTeams.length) {
          // console.log('Allocate', next-idx, 'teams to group', step.groups[groupIdx].name);
          step.groups[groupIdx].teams = step.inputTeams.slice(idx, next);
          idx = next;
        }
      });
      if (idx < step.inputTeams.length) {
          // no more space in group ==> put team as output team directly without playing
          console.log('No group to allocate the ', step.inputTeams.length-idx, 'teams => ouput directly');
          step.inputTeams.slice(idx, step.inputTeams.length).forEach(it => step.outputTeams.push(it));
      }
    } else if (step.spreadTeamsAlgo === 'Spread best teams') {
      let groupIdx = 0;
      let noMoreSpace = false;
      step.inputTeams.forEach((it) => {
        if (noMoreSpace) {
          // store the team at the end of the output team because there is no group for this team
          step.outputTeams.push(it);
        } else {
          // find next group needing a team
          const nextGroupIdx = this.findNextGroupNeedingTeam(groupIdx, step);
          if (nextGroupIdx === undefined) {
            // no more space in group ==> put team as output team directly without playing
            console.log('No group to allocate the team => ouput directly');
            noMoreSpace = true;
            step.outputTeams.push(it);
          } else {
            console.log('Allocate team', it.rank, ' to group', step.groups[groupIdx].name);
            step.groups[groupIdx].teams.push(it);
          }
          // go to next group
          groupIdx = (groupIdx + 1) % step.groups.length;
        }
      });
    } else if (step.spreadTeamsAlgo === 'Random') {
      let noMoreSpace = false;
      step.inputTeams.forEach((it) => {
        if (noMoreSpace) {
          // store the team at the end of the output team because there is no group for this team
          step.outputTeams.push(it);
        } else {
          // find next group needing a team
          const groupIdxs = this.findNextGroupsIdx(step);
          if (groupIdxs.length > 0) {
            const groupIdx = (Math.random() * 1000) % groupIdxs.length;
            // console.log('Allocate team', rt.rank, ' to group', step.groups[groupIdx].name);
            step.groups[groupIdx].teams.push(it);
          } else {
            // no more space in group ==> put team as output team directly without playing
            console.log('No group to allocate the team => ouput directly');
            noMoreSpace = true;
            step.outputTeams.push(it);
          }
        }
      });
    } else if (step.spreadTeamsAlgo === ' Manual' && step.position === 0) {
    } else {
      throw new Error('Unmanaged distribution strategy: ' + step.spreadTeamsAlgo);
    }
    const error = step.groups
      .filter((group, groupIdx) => group.teams.length !== step.drawType.groups[groupIdx].nbTeams)
      .map((group) => group.name + ':' + group.teams.length)
      .join(', ');
    if (error && error.length) throw new Error('Some groupes does not have the required teams: ' + error);
  }
  
  /**
   * Search the index of the next group need a team to add. It starts to search from
   * the groupIdx. If no group is found after this index, the search is restarted from
   * the first group (index 0).
   * @param groupIdx is the start index for the search.
   * @param step the Step Object containing the group and group description via the drawType
   * @returns the index of a group needed a team, or undefined.
   */
  private findNextGroupNeedingTeam(groupIdx: number, step: Step): number | undefined {
    // search into next groups
    for (let index = groupIdx; index < step.groups.length; index++) {
      if (step.drawType.groups[index].nbTeams > step.groups[index].teams.length) {
        // console.log('findNextGroupNeedingTeam, found', index, step.drawType.groups[index].nbTeams, step.groups[index].teams.length);
        return index;
      } else {
        // console.log('findNextGroupNeedingTeam, rejected', index, step.drawType.groups[index].nbTeams, step.groups[index].teams.length);
      }
    }
    // search into previous groups
    for (let index = 0; index < groupIdx; index++) {
      if (step.drawType.groups[index].nbTeams > step.groups[index].teams.length) {
        console.log(
          'findNextGroupNeedingTeam2, found',
          index,
          step.drawType.groups[index].nbTeams,
          step.groups[index].teams.length,
        );
        return index;
      } else {
        console.log(
          'findNextGroupNeedingTeam2, rejected',
          index,
          step.drawType.groups[index].nbTeams,
          step.groups[index].teams.length,
        );
      }
    }
    console.log('findNextGroupNeedingTeam', groupIdx, '=> no found');
    // no group needs more teams
    return undefined;
  }

  /**
   * Compute the indexes of the groups where a team is required.
   * @param step is a Step object
   * @returns an array of group indexes. Can be empty.
   */
  private findNextGroupsIdx(step: Step): number[] {
    let result: number[] = [];
    step.drawType.groups.forEach((group, groupIdx) => {
      if (group.nbTeams > step.inputTeams.length) {
        result.push(groupIdx);
      }
    });
    return result;
  }

  //////////////////////////////////////////////////////////////////////////
  // GAMES ALLOCATION MEHTODS
  //////////////////////////////////////////////////////////////////////////

  /**
   * Allocates games in groups of a step
   */
  private allocateGames(draw: DivisionDraw, step: Step, divisionShortName: string) {
    const whatPrefix = divisionShortName + '-' + step.name;
    step.groups.forEach((group, groupIdx) => {
      const groupDesc: DrawTypeSubGroup = step.drawType.groups[groupIdx];
      this.allocateGroupGames(draw, step, group, groupDesc, whatPrefix+'-'+group.name);
      if (group.games.length !== groupDesc.nbGames) {
        throw new Error(
          'Expected ' + groupDesc.nbGames + ' but ' + group.games.length + ' are allocated in group ' + group.name,
        );
      }
    });
  }
  /**
   * Allocates games in a group of a step
   * It delegates the implementation to each method specific to the GroupType
   * @param step is the Step object
   * @param group is the Group object containing teams and where the game must be allocated
   * @param groupDesc is the descriptor of the group (from DrawType)
   * @param whatPrefix is the prefix to use for naming the 'what' of a game
   * @throws Error when the group type is not supported.
   */
  private allocateGroupGames(draw: DivisionDraw, step: Step, group: Group, groupDesc: DrawTypeSubGroup, whatPrefix: string) {
    switch (groupDesc.groupType) {
      case 'NONE':
        return;
      case '2_WINS':
      case '3_WINS':
      case '4_WINS':
      case '5_WINS':
        return this.allocateGroupGamesWins(draw, step, group, groupDesc, whatPrefix);
      case 'POOL':
        return this.allocateGroupGamesPool(draw, step, group, whatPrefix, 1);
      case 'POOL_RET':
        return this.allocateGroupGamesPool(draw, step, group, whatPrefix, 2);
      case 'POOL_3':
        return this.allocateGroupGamesPool(draw, step, group, whatPrefix, 3);
      case 'SEMI':
        return this.allocateGroupGamesSemi(draw, step, group, groupDesc, whatPrefix);
      default:
        if (groupDesc.groupType.startsWith('CUP')) {
          return this.drawCupService.allocateGroupGamesCup(step, group, groupDesc.groupType, whatPrefix);
        }
        throw new Error('GroupType is not supported yet: ' + groupDesc.groupType);
    }
  }

  /**
   * Allocates games for a group Type WINS*
   * @param step is the Step object
   * @param group is the Group object containing teams and where the game must be allocated
   * @param groupDesc is the descriptor of the group (from DrawType)
   * @param whatPrefix is the prefix to use for naming the 'what' of a game
   */
  private allocateGroupGamesWins(draw: DivisionDraw, step: Step, group: Group, groupDesc: DrawTypeSubGroup, whatPrefix: string) {
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
  /**
   * Allocates games for a group Type POOL*
   * @param step is the Step object
   * @param group is the Group object containing teams and where the game must be allocated
   * @param groupDesc is the descriptor of the group (from DrawType)
   * @param whatPrefix is the prefix to use for naming the 'what' of a game
   */
  private allocateGroupGamesPool(draw: DivisionDraw, step: Step, group: Group, whatPrefix: string, nbGamePerCouple: number) {
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
  private getTeamReference(rank: number, step: Step, draw: DivisionDraw): TeamReference {
    console.log('getTeamReference', rank, step, draw);
    const tr: TeamReference = { teamSelectorType: 'RANK_IN_STEP', rank };
    if (step.position > 0) {
      tr.stepId = draw.steps[step.position-1].id;
    }
    if (step.inputTeams[rank-1].teamId) {
      tr.teamId = step.inputTeams[rank-1].teamId
    }
    return tr;
  }

  /**
   * Allocates games for a group Type SEMI*: 1vs2,3vs4
   * @param step is the Step object
   * @param group is the Group object containing teams and where the game must be allocated
   * @param groupDesc is the descriptor of the group (from DrawType)
   * @param whatPrefix is the prefix to use for naming the 'what' of a game
   */
  private allocateGroupGamesSemi(draw: DivisionDraw, step: Step, group: Group, groupDesc: DrawTypeSubGroup, whatPrefix: string) {
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

  //////////////////////////////////////////////////////////////////////////
  // OUTPUT TEAMS MEHTODS
  //////////////////////////////////////////////////////////////////////////

  private allocateOutputTeams(step: Step) {
    let trs: TeamReference[] = []
    if (step.groups.length === 1 || step.ouputTeamRankingStrategy === 'GROUP_ORDER') {
      // iterator over teach by using the result of the group.
      step.groups.forEach(group => {
        for (let teamIdx = 0; teamIdx < group.teams.length; teamIdx++) {        
          trs.push(this.getOuputTeamReferenceFromGroup(group, teamIdx+1));
        }
      });

    } else if (step.ouputTeamRankingStrategy === 'BEST_TOGETHER') {
      // Take the first of each group, then the second of each group
      const maxTeams = step.drawType.groups.map(groupDesc => groupDesc.nbTeams).reduce((a,b) => Math.max(a,b), 0)
      // iterator over rank 
      for (let teamIdx = 0; teamIdx < maxTeams; teamIdx++) {
        step.groups
          // Keep groups having the team at the expected rank
          .filter((group, gropuIdx) => teamIdx < step.drawType.groups[gropuIdx].nbTeams)
          // foreach group take the team at the rank
          .forEach(group => trs.push(this.getOuputTeamReferenceFromGroup(group, teamIdx+1)));        
      }
    }
    // insert the ouput team from the groups at the beginning of the list, 
    // because teams could not play during this step
    step.outputTeams = [...trs, ...step.outputTeams];
  }
  private getOuputTeamReferenceFromGroup(group: Group, rank: number): TeamReference {
    if ('ouputTeams' in group.specificData) {
      const otrs = (group.specificData as SpecificDataCup).ouputTeams;
      if (otrs && otrs.length > 0) {
        const tr = otrs.find(otr => otr.rank === rank);
        if (tr) {
          return tr;
        }
        throw new Error('Internal error: group.specificData.outputTeams does not contains a team ranked '+ rank);
      }
      throw new Error('Internal error: group.specificData.outputTeams does not contains any team'+ otrs);
    } else {
      return { teamSelectorType: 'RANK_IN_GROUP', rank: rank, groupId: group.id }
    }
  }

}

