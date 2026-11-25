import { Component, computed, effect, inject, signal } from "@angular/core";
import { DrawGameCell, GameData } from "./draw-game-cell.component";
import { AbstractDrawCupComponent } from './abstract-draw-cup.component';

/** Displays the match planning grouped by referee coach. */
@Component({
  selector: 'app-draw-cuprk4',
  template: `
    <table class="draw">
      <tbody>
        <tr>
          <!-- 1 column per round -->
          @for(roundData of roundDatas(); track roundData.round) {
            <td style="vertical-align: middle;">
              <table style="height: 100%;">
                <!-- 1 row per game -->
                @for(rowData of roundData.rows; track rowData.row) {
                  <tr>
                    <td rowspan="2">
                      @for(gameData of rowData.gameDatas; track gameData.drawGame.id) {
                        <app-draw-gamecell [gameData]="gameData"></app-draw-gamecell>
                      }
                    </td>
                  </tr>
                }
              </table>
            </td>
          }
       </tr>
      </tbody>
    </table>
  `,
  styles: [`
    
    `],
  imports: [DrawGameCell],
})
export class DrawCupRk4Component extends AbstractDrawCupComponent {

  roundDatas = signal<RoundData[]>([]);
  cup = computed<number>(() => this.group()?.teams.length ?? 0 );
  lastRound = computed<number>(() => {
    if (!this.group()) return 0;
    return this.group()!.games.map(drawGame => drawGame.round).reduce((a,b) => Math.max(a,b), 0)
  });

  protected assignGameData(gameData: GameData) {
    if (this.cup() === 0 || this.lastRound() === 0) return;
    let roundData: RoundData|undefined = this.roundDatas().find(roundData => roundData.round === gameData.drawGame.round);
    if (!roundData) {
      const nbRow = this.cup() / (2 * gameData.drawGame.round);
      roundData = { round: gameData.drawGame.round, nbRow, rows: [] };
      this.roundDatas.update(rds => [...rds, roundData!]);
    }
    const row = gameData.drawGame.round === this.lastRound()
      ? 1 
      : this.drawCupService.getGameIndex(gameData.drawGame.what) + 1 ;
    let rowData: RowData|undefined = roundData.rows.find(rd => rd.row === row);
    if (!rowData) {
      rowData = { row, gameDatas: [] };
      roundData.rows.push(rowData);
    }
    rowData.gameDatas.push(gameData);
    if (gameData.drawGame.round === this.lastRound()) {
      rowData.gameDatas.sort((gd1,gd2) => this.drawCupService.isFinal(gd1.drawGame.what) ? 1 : -1);
    }

    this.roundDatas.update(rds => [...rds]);
  }
}

interface RoundData {
  round: number;
  nbRow: number;
  rows: RowData[];
}
interface RowData {
  row: number;
  gameDatas: GameData[];
}
