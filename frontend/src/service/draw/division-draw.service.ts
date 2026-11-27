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
import { DrawPoolService } from './draw-pool.service';
import { DrawWinsService } from './draw-wins.service';
import { DrawRankingService } from './draw-ranking.service';
import { GroupAllocParams } from './draw-abstract.service';

/** Provides persistence operations for competition draws belonging to tournaments. */
@Injectable({ providedIn: 'root' })
export class DivisionDrawService extends AbstractPersistentDataService<DivisionDraw> {
  private readonly drawCupService = inject(DrawCupService);
  private readonly drawPoolService = inject(DrawPoolService);
  private readonly drawWinsService = inject(DrawWinsService);
  private readonly drawRankingService = inject(DrawRankingService);

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
        //console.log( 'findNextGroupNeedingTeam2, found', index, step.drawType.groups[index].nbTeams, step.groups[index].teams.length, );
        return index;
      } else {
        // console.log('findNextGroupNeedingTeam2, rejected', index, step.drawType.groups[index].nbTeams, step.groups[index].teams.length);
      }
    }
    // console.log('findNextGroupNeedingTeam', groupIdx, '=> no found');
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
    const groupAllocParams : GroupAllocParams = {draw, step, group, groupDesc, whatPrefix};
    switch (groupDesc.groupType) {
      case 'NONE':
        return;
      case '2_WINS':
      case '3_WINS':
      case '4_WINS':
      case '5_WINS':
        return this.drawWinsService.allocateGroupGames(groupAllocParams);
      case 'POOL':
        return this.drawPoolService.allocateGroupGames({...groupAllocParams, nbGamePerCouple: 1});
      case 'POOL_RET':
        return this.drawPoolService.allocateGroupGames({...groupAllocParams, nbGamePerCouple: 2});
      case 'POOL_3':
        return this.drawPoolService.allocateGroupGames({...groupAllocParams, nbGamePerCouple: 3});
      case 'SEMI':
      case 'RANKING':
        return this.drawRankingService.allocateGroupGames(groupAllocParams);
      default:
        if (groupDesc.groupType.startsWith('CUP')) {
          return this.drawCupService.allocateGroupGames(groupAllocParams);
        }
        throw new Error('GroupType is not supported yet: ' + groupDesc.groupType);
    }
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

