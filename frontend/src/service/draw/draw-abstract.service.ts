import { inject, Injectable } from "@angular/core";
import { DivisionDraw, TeamReference, Step, Group, DrawTypeSubGroup, Game, Division, DrawGame } from "@tournament-manager/persistent-data-model";
import { GameService } from "../game.service";
import { firstValueFrom } from "rxjs";
import { DivisionDrawService } from "./division-draw.service";

@Injectable({ providedIn: 'root' })
export abstract class DrawAbstractService  {
  drawDivisionService = inject(DivisionDrawService)
  gameService = inject(GameService);
  
  public abstract allocateGroupGames(groupAllocParams : GroupAllocParams): void;

  protected getTeamReference(rank: number, step: Step, draw: DivisionDraw): TeamReference {
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

    /** Returns a team label, using ? for an unresolved draw reference. */
  public teamLabel(
    reference: TeamReference, 
    draw: DivisionDraw,
    division:Division): string {
    if (!reference) return '';
    if (reference.teamId) {
      const team = division.teams.find(team => team.id === reference.teamId);
      if (team) return team.name 
    }
    switch (reference?.teamSelectorType) {
      case 'RANK_IN_GROUP':
        return this.rankName(reference.rank!) + ' of group ' + this.getGroupName(reference.groupId, draw);
      case 'RANK_IN_STEP': {
        return this.rankName(reference.rank!) + ' of step ' + this.getStepName(reference.stepId, draw);
      }
      case 'WINNER_OF':
        return 'Winner of ' + this.getGamewhat(reference.drawGameId, draw);
      case 'LOSER_OF':
        return 'Loser of ' + this.getGamewhat(reference.drawGameId, draw);
      default:
        return '?';
    }
  }

  public getGroupName(groupId: string | undefined, draw: DivisionDraw | undefined): string {
    if (!groupId) return '?';
    if (!draw) return 'Group';
    let group: Group | undefined;
    draw.steps.find((s) => {
      group = s.groups.find((g) => g.id === groupId);
      return group;
    });
    return group ? group.name : 'Group';
  }

  public getStepName(stepId: string | undefined, draw: DivisionDraw | undefined): string {
    if (!stepId) return '?';
    if (!draw) return 'Step';
    const step: Step | undefined = draw.steps.find((s) => s.id === stepId);
    if (!step) return 'Step';
    return step.name;
  }

  public getGamewhat(drawGameId: string | undefined, draw: DivisionDraw | undefined): string {
    if (!draw) return 'Game';
    let what = '?';
    draw.steps.find((s) => {
      return s.groups.find((g) => {
        const game = g.games.find((g) => g.id === drawGameId);
        if (game) what = game.what;
        return game;
      });
    });
    if (what === '?') {
      console.log('DrawGameId '+drawGameId+' not found in',
        draw.steps.map((s) => s.groups.map((group) => 
          group.games.map(game => s.name + '.'+ group.name+'.'+game.id))).flat(2).join(',\n'));
    }
    return what;
  }

  
  public rankName(rank: number | undefined): string {
    if (rank === undefined) return '?';
    switch (rank) {
      case 1:
      case 11:
      case 21:
      case 31:
      case 41:
      case 51:
      case 61:
        return rank + 'st';
      case 2:
        return rank + 'nd';
      case 12:
      case 22:
      case 32:
      case 42:
      case 52:
      case 62:
      case 3:
        return rank + 'rd';
      case 13:
      case 23:
      case 33:
      case 43:
      case 53:
      case 63:
      default:
        return rank + 'th';
    }
  }
}

export interface GroupAllocParams {
  draw: DivisionDraw;
  step: Step;
  group: Group;
  groupDesc: DrawTypeSubGroup;
  whatPrefix: string;
  nbGamePerCouple?: number;
}