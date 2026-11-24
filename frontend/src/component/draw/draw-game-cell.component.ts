import { Component, computed, inject, input } from "@angular/core";
import { Day, Division, DrawGame, Field, Game, Team, Timeslot, Tournament } from "@tournament-manager/persistent-data-model";
import { DateService } from "../../service/date.service";

/** Displays the match planning grouped by referee coach. */
@Component({
  selector: 'app-draw-gamecell',
  template: `
    @if(gameData()) {
    <div class="game">
      <table  cellSpacing="0" cellPadding="5" border="0">
        <tbody>
          <tr class="row-title">
            <td colspan="2" class="last-col">
              <div class="title-what">{{gameData()!.drawGame.what}}</div>
              <div class="title-times">{{day()}} - {{ timeslot() }} - Field {{gameData()!.field?.name}}</div>
            </td>
          </tr>
          <tr class="row-team">
            <td class="team-col">{{gameData()!.homeTeamName}}</td>
            <td class="score-col last-col">{{homeScore()}}</td>
          </tr>
          <tr class="row-team last-row">
            <td class="team-col">{{gameData()!.awayTeamName}}</td>
            <td class="score-col last-col">{{awayScore()}}</td>
          </tr>
        </tbody>
      </table>
    </div>
    }
  `,
  styles: [
    `
    .game {
      text-align: center;
      vertical-align: middle;
    }

    td { 
      border: 1px solid var(--p-content-border-color);
      border-bottom: none; 
      border-right: none; 
    }
    .last-col { border-right: 1px solid var(--p-content-border-color); }  
    .last-row td { border-bottom: 1px solid var(--p-content-border-color); }

    .row-title {
      text-align: center;
      background-color: var(--p-surface-100);
    }
    .title-what { font-weight: bold; font-size: 1.1rem; margin: 8px;}
    .title-times { font-style: italic;}

    .team-col { min-width: 10rem; text-align: right; }
    .score-col {  width: 2.5rem;  }
    `,
  ],
})
export class DrawGameCell {
  dateService = inject(DateService);
  gameData = input<GameData|undefined>();
  tournament = input<Tournament|undefined>();

  homeScore = computed(() => {
    const score = this.gameData()?.game?.score;
    return score ? score.homeTeamScore : '-';
  });
  awayScore = computed(() => {
    const score = this.gameData()?.game?.score;
    return score ? score.awayTeamScore : '-';
  });

  day = computed(() =>{
    const day = this.gameData()?.day;
    return day ? new Intl.DateTimeFormat('fr-FR').format(new Date(day.date * 1000)) : '—';
  })

  /** Returns the formatted start time or an unavailable-value marker. */
  timeslot = computed(() =>{
    const timeslot = this.gameData()?.timeSlot;
    return timeslot ? this.dateService.toTime(timeslot.start) : '—';
  });
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