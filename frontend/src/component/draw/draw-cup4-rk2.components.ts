import { Component, effect, inject, signal } from "@angular/core";
import { DrawGameCell, GameData } from "./draw-game-cell.component";
import { AbstractDrawCupComponent } from './abstract-draw-cup.component';

/** Displays the match planning grouped by referee coach. */
@Component({
  selector: 'app-draw-cup4rk2',
  styleUrl: './draw-cup.component.css',
  template: `
    <table class="draw">
      <tbody>
        <tr>
          <td rowspan="2" class="game-cell"><app-draw-gamecell [gameData]="gameSF1()"></app-draw-gamecell></td>
          <td class=""space-col></td>
          <td></td>
          <td></td>
        </tr>
        <tr>
          // row span of the first cell
          <td class="link-top"></td>
          <td class="link-top link-right"></td>
          <td class="link-top vert-center"></td>
        </tr>
        <tr>
          <td></td>
          <td></td>
          <td colspan="2" class="game-cell"><app-draw-gamecell [gameData]="gameFinal()"></app-draw-gamecell></td>
        </tr>
        <tr>
          <td rowspan="2" class="game-cell"><app-draw-gamecell [gameData]="gameSF2()"></app-draw-gamecell></td>
          <td></td>
          <td class="link-right"></td>
          <td class="cell-center"></td>
        </tr>
        <tr>
          // row span of the first cell
          <td class="link-top"></td>
          <td class="link-top"></td>
          <td class="link-top"></td>
        </tr>
      </tbody>
    </table>
  `,
  imports: [DrawGameCell],
})
export class DrawCup4Rk2Component extends AbstractDrawCupComponent {
  gameSF1 = signal<GameData|undefined>(undefined);
  gameSF2 = signal<GameData|undefined>(undefined);
  gameFinal = signal<GameData|undefined>(undefined);

  protected assignGameData(gameData: GameData) {
    if (gameData.drawGame.round === 1) {
      if (this.drawCupService.getGameIndex(gameData.drawGame.what) === 1) { // semi final 1
        this.gameSF1.set(gameData);
      } else { // semi final 2
        this.gameSF2.set(gameData);
      }
    } else if (gameData.drawGame.round === 2) {
      this.gameFinal.set(gameData);
    }
  }
}
