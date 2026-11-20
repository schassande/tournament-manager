import { Component, computed, input } from "@angular/core";
import { Day, Division, DrawGame, Field, Game, Team, Timeslot } from "@tournament-manager/persistent-data-model";

/** Displays the match planning grouped by referee coach. */
@Component({
  selector: 'app-draw-gamecell',
  template: `
    @if(gameData()) {
    <table>
      <tbody>
        <tr class="row-what">
          <td colspan="2">{{gameData()!.drawGame.what}}</td>
        </tr>
        <tr>
          <td class="team-col">{{gameData()!.homeTeamName}}</td>
          <td class="score-col">{{homeScore()}}/td>
        </tr>
        <tr>
          <td class="team-col">{{gameData()!.awayTeamName}}</td>
          <td class="score-col">{{awayScore()}}</td>
        </tr>
        <tr class="row-time">
          <td colspan="2">{{gameData()!.day?.date}} - {{ gameData()!.timeSlot?.start }} - Field {{gameData()!.field?.name}} - {{status()}}</td>
        </tr>
      </tbody>
    </table>
    }
  `,
  styles: [
    `td { border: 1px solid black; }
    .row-what, .row-time { text-align: center; }
    .team-col { width: 15 rem; }
    .score-col { width: 2.5rem; }
    `,
  ],
})
export class DrawGameCell {
  gameData = input<GameData|undefined>();
  homeScore = computed(() =>'')
  awayScore = computed(() =>'')
  status = computed(() =>'')
}

export interface GameData {
  drawGame: DrawGame;
  game?: Game;
  division: Division;
  homeTeamName?: string;
  awayTeamName?: string;
  day?: Day;
  timeSlot?: Timeslot;
  field?: Field;
}