import { Injectable } from '@angular/core';
import { Division, DivisionDraw, DrawGame, Group, GroupType, SpecificDataCup, Step, TeamReference } from '@tournament-manager/persistent-data-model';

@Injectable({ providedIn: 'root' })
export class DrawCupService  {

  /**
   * Allocates games for a group Type CUP*
   * It delegates the game creation to a recurisve method.
   * @param step is the Step object
   * @param group is the Group object containing teams and where the game must be allocated
   * @param groupDesc is the descriptor of the group (from DrawType)
   * @param whatPrefix is the prefix to use for naming the 'what' of a game
   * @throws Error when the group type is not well formatted
   */
  public allocateGroupGamesCup(step: Step, group: Group, groupType: GroupType, whatPrefix: string) {
    // extract and verify group dimension from group type: "CUP<cup>_RK<rk>"
    const match = groupType.match(/^CUP(\d+)_RK(\d+)$/);
    const cupStr = match?.[1]; // "128"
    const rkStr = match?.[2]; // "4"
    if (!cupStr || !rkStr) throw new Error('Malformed Cup groupType: ' + groupType);
    const cup = Number.parseInt(cupStr);
    const rk = Number.parseInt(rkStr);
    if (Number.isNaN(cup) || Number.isNaN(rk) || !this.isPowerOfTwo(cup) || !this.isPowerOfTwo(rk))
      throw new Error('Malformed Cup groupType: ' + groupType);

    const cupSpecificData: SpecificDataCup = group.specificData as SpecificDataCup; 
    cupSpecificData.ouputTeams = [];

    // call the recursive method for the first round
    this.allocateGroupGamesCupLevel(cup, rk, [], true, 1, group, step, whatPrefix, { first: 1, last: cup });

    cupSpecificData.ouputTeams.sort((ot1, ot2) => ot2.rank! - ot1.rank!)
  }

  /**
   * IT allocates game for a CUP structure. It is a recursive method in order to allocate the next
   * games based on winners or the losers.
   * @param cup is the number of teams to play. Alaways a power of 2
   * @param rk is the number of team to rank. Alaways a power of 2
   * @param previousGames is the list of previous games when round > 1. [] otherwise.
   * @param winner flag indicating if the games to create must be between the winners or the losers of the previous games
   * @param round indicate the round of the cup (1, 2, 3 ...). Round indicates the order to play.
   * @param group is the group containing teams and where to create the games
   * @param whatPrefix is the prefix to use for naming the 'what' of a game
   * @param ranks a PlayingRanks object
   */
  protected allocateGroupGamesCupLevel(
    cup: number,
    rk: number,
    previousGames: DrawGame[],
    winner: boolean,
    round: number,
    group: Group,
    step: Step,
    whatPrefix: string,
    ranks: PlayingRanks,
  ) {
    const newGames = [];
    // allocate the games between the winner or looser of the previous game (or the group
    // inputTeam if first round)
    const cupSpecificData: SpecificDataCup = group.specificData as SpecificDataCup; 
    if (!cupSpecificData.ouputTeams)  cupSpecificData.ouputTeams = [];
    for (let gameIndex = 0; gameIndex < cup / 2; gameIndex++) {
      const game: DrawGame = {
        // console.log('Allocate cup game', group.name, ranks.first, ranks.last, gameIndex);
        awayTeam: this.getCupTeam(round, gameIndex, previousGames, false, winner, group),
        homeTeam: this.getCupTeam(round, gameIndex, previousGames, true, winner, group),
        id: crypto.randomUUID(),
        resultRequired: true,
        round,
        status: 'DRAWN',
        what: whatPrefix + '-' + this.cupWhat(ranks, gameIndex),
      };
      if (ranks.last - ranks.first === 1) {
        // console.log('Allocate ouput teams winner and loser', group.name, ranks.first, ranks.last, gameIndex);
        // This game defines ranks for the winner and the loser
        // winner is ranked <ranks.first>
        cupSpecificData.ouputTeams.push({teamSelectorType: 'WINNER_OF', drawGameId: game.id, rank: ranks.first});
        // Loer is ranked <ranks.last>
        cupSpecificData.ouputTeams.push({teamSelectorType: 'LOSER_OF', drawGameId: game.id, rank: ranks.last});
      }
      newGames.push(game);
      group.games.push(game);
    }
    // next round by recursivity
    if (cup > 2) {
      // continue to the next round with the winners
      this.allocateGroupGamesCupLevel(cup / 2, rk, newGames, true, round + 1, group, step, whatPrefix, {
        first: ranks.first,
        last: ranks.last / 2,
      });
    }
    if (cup > 2 && ranks.last <= rk) {
      // Neet to rank the loosers too.
      this.allocateGroupGamesCupLevel(cup / 2, rk, newGames, false, round + 1, group, step, whatPrefix, {
        first: ranks.last / 2 + 1,
        last: ranks.last,
      });
    }
  }

  /**
   * Build a TeamReference referencing a team of the previous game or from the input teams of the group
   * @param round indicating the round of the game
   * @param gameIndex is the index of the game in the round. 0 based value.
   * @param previousGames list of the previous games. An empty array if first round
   * @param home flag indicating if the selecting team will be the home team or the away team
   * @param winner flag indicating if the selected team must be the winner or the lose of the previous game.
   * @returns a TeamReference object
   */
  private getCupTeam(
    round: number,
    gameIndex: number,
    previousGames: DrawGame[],
    home: boolean,
    winner: boolean,
    group: Group): TeamReference {
    if (round === 1) {
      // For the first round, pick up the team from the input teams of the group
      // home team: pick up the best team, away team: pick up the worst team
      const idx: number = home ? gameIndex : group.teams.length - 1 - gameIndex;
      return group.teams[idx]
    } else {
      // When it is not the first round, pick the team from the result of a previous game.
      return {
        teamSelectorType: winner ? 'WINNER_OF' : 'LOSER_OF',
        drawGameId: previousGames[gameIndex * 2 + (home ? 0 : 1)].id,
      };
    }
  }
  /**
   * Tool method computing if a number is a power of 2.
   * @param value a number.
   * @returns boolean value indicating if the number is a power of 2.
   */
  private isPowerOfTwo(value: number): boolean {
    return value > 0 && (value & (value - 1)) === 0;
  }

  private static readonly PREFIX_FINAL: string = 'Final';
  /**
   * Build a string describing the what attribute of a game in a Cup structure.
   * @param ranks a PlayingRanks
   * @returns a string
   */
  private cupWhat(ranks: PlayingRanks, gameIndex:number): string {
    if (ranks.first === 1 && ranks.last === 2) {
      return DrawCupService.PREFIX_FINAL;

    } else if (ranks.first === 3 && ranks.last === 4) {
      return '3rd';

    } else if (ranks.first + 1 === ranks.last) {
      return ranks.first + 'th';

    } else if (ranks.first === 1 && ranks.last === 4) {
      return 'Semi-Final #' + (gameIndex+1);

    } else if (ranks.first === 1 && ranks.last === 8) {
      return 'Quarter-Final #' + (gameIndex+1);

    } else if (ranks.first === 1 && ranks.last === 16) {
      return 'Last 16 #' + (gameIndex+1);

    } else if (ranks.first === 1 && ranks.last === 32) {
      return 'Last 32 #' + (gameIndex+1);

    } else if (ranks.first === 1 && ranks.last === 64) {
      return 'Last 64 #' + (gameIndex+1);

    } else if (ranks.first === 1 && ranks.last === 128) {
      return 'Last 128 #' + (gameIndex+1);

    } else {
      return ranks.first + '-' + ranks.last+' #'+(gameIndex+1);
    }
  }
  public isFinal(what: string) {
    return what.indexOf(DrawCupService.PREFIX_FINAL) >=0 ;
  }
  public getGameIndex(what: string): number {
    const idx = what.lastIndexOf('#');
    console.log(what, idx, what.length)
    if (idx < 0 || what.length < (idx+2)) {
      return -1;
    }
    const nbStr = what.substring(idx+1).trim();
    const nb = Number.parseInt(nbStr);
    if (Number.isNaN(nbStr)) {
      return -1;
    }
    return nb;
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
  //  const draw: DivisionDraw | undefined = this.draws().find((d) => d.id === item.drawId);

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
}


/**
 * It is a internal structure containg first/last fields used for allocating games.
 * They indicates what are the ranks, the teams are playing.
 * Examples:
 *   1-2 is a final.
 *   1-4 is a semi final,
 *   5-8 is a semi final but for the losers of quarter finals
 */
interface PlayingRanks {
  /** The best rank. Always an odd number: 1, 3, 5, 7 ... */
  first: number;
  /** The worst rank. always an even number: 2, 4, 6, 8 ... */
  last: number;
}
