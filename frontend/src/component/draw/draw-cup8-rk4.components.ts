import { Component, computed, effect, signal } from "@angular/core";
import { DrawGameCell, GameData } from "./draw-game-cell.component";
import { getGameIndex, isFinal } from "../../service/draw-cup.service";
import { AbstractDrawCupComponent } from './abstract-draw-cup.component';
import { Group, Step } from "@tournament-manager/persistent-data-model";

/** Displays the match planning grouped by referee coach. */
@Component({
  selector: 'app-draw-cup8rk4',
  styleUrl: './draw-cup.component.css',
  template: `
    <table class="draw">
      <tbody>
        <!-- Grid: 14 rows x 8 columns -->
        <tr><!-- Row 1: QF1 - - -  - - - -   -->
          <td rowspan="2" class="game-cell"><app-draw-gamecell [gameData]="gameQF1()"></app-draw-gamecell></td>
          <td></td>
          <td></td>
          <td></td>

          <td></td>
          <td class="space-col"></td>
          <td></td>
          <td></td>
        </tr>
        <tr><!-- Row 2:  QF1 TR - -    - - - -  -->
          <!-- row span of QF1 (1 col)-->
          <td class="link-top link-right"></td>
          <td></td>
          <td></td>

          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>
        <tr><!-- Row 3: - SF1 SF1 -  - - - -  -->
          <td></td>
          <td colspan="2" rowspan="2" class="game-cell"><app-draw-gamecell [gameData]="gameSF1()"></app-draw-gamecell></td>
          <td></td>

          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>
        <tr><!-- Row 4: - SF1 SF1 TR   T T TR - -->
          <td></td>
          <!-- row span of SF1 (2 col) -->
          <td class="link-top link-right"></td>

          <td class="link-top"></td>
          <td class="link-top"></td>
          <td class="link-top link-right"></td>
          <td></td>
        </tr>
        <tr><!-- Row 5: QF2 R - R   - - R - -->
          <td rowspan="2" class="game-cell"><app-draw-gamecell [gameData]="gameQF2()"></app-draw-gamecell></td>
          <td class="link-right"></td>
          <td></td>
          <td class="link-right"></td>

          <td></td>
          <td></td>
          <td class="link-right"></td>
          <td></td>
        </tr>
        <tr><!-- Row 6: QF2 T - R   - - R - -->
          <!-- row span of QF2 (1 col) -->
          <td class="link-top"></td>
          <td></td>
          <td class="link-right"></td>
 
          <td></td>
          <td></td>
          <td class="link-right"></td>
          <td></td>
        </tr>
        <tr><!-- Row 7: - - - 3RD   3RD - F F -->
          <td></td>
          <td></td>
          <td></td>
          <td colspan="2" class="game-cell"><app-draw-gamecell [gameData]="game3rd()"></app-draw-gamecell></td>
          <td></td>
          <td colspan="2" class="game-cell"><app-draw-gamecell [gameData]="gameFinal()"></app-draw-gamecell></td>
        </tr>
        <tr><!-- Row 8: - - - 3RD   3RD - F F -->
          <td class="link-top"></td>
          <td class="link-top"></td>
          <td class="link-top"></td>
          <!-- row span of the 3rd (2 col) -->
          <td></td>
          <!-- row span of the 1st (2 col) -->
        </tr>
        <tr><!-- Row 9: QF3 - - R    - - R -  -->
          <td rowspan="2" class="game-cell"><app-draw-gamecell [gameData]="gameQF3()"></app-draw-gamecell></td>
          <td></td>
          <td></td>
          <td class="link-right"></td>

          <td></td>
          <td></td>
          <td class="link-right"></td>
          <td></td>
        </tr>
        <tr><!-- Row 10: QF3 TR - R   - - R -  -->
          <!-- row span of QF3 (1 col)-->
          <td class="link-top link-right"></td>
          <td></td>
          <td class="link-right"></td>

          <td></td>
          <td></td>
          <td class="link-right"></td>
          <td></td>
        </tr>
        <tr><!-- Row 11: - SF2 SF2 R   - - R -  -->
          <td></td>
          <td rowspan="2" class="game-cell"><app-draw-gamecell [gameData]="gameSF2()"></app-draw-gamecell></td>
          <td class="link-right"></td>
          <td></td>

          <td></td>
          <td></td>
          <td class="link-right"></td>
          <td></td>
        </tr>
        <tr><!-- Row 12: - SF2 SF2 T   T T T -  -->
          <td></td>
          <!-- row span of SF2 (2 col)-->
          <td class="link-top"></td>

          <td class="link-top"></td>
          <td class="link-top"></td>
          <td class="link-top"></td>
          <td></td>
        </tr>
        <tr><!-- Row 13: QF4 R -    - - - -  -->
          <td rowspan="2" class="game-cell"><app-draw-gamecell [gameData]="gameQF4()"></app-draw-gamecell></td>
          <td class="link-right"></td>
          <td></td>
          <td></td>

          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>
        <tr><!-- Row 14: QF4 T - -    - - - -  -->
          <!-- row span of QF4 (1 col)-->
          <td class="link-top"></td>
          <td></td>
          <td></td>

          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>
      </tbody>
    </table>
  `,
  imports: [DrawGameCell],
})
export class DrawCup8Rk4Component extends AbstractDrawCupComponent {  
  gameQF1 = signal<GameData|undefined>(undefined);
  gameQF2 = signal<GameData|undefined>(undefined);
  gameQF3 = signal<GameData|undefined>(undefined);
  gameQF4 = signal<GameData|undefined>(undefined);
  gameSF1 = signal<GameData|undefined>(undefined);
  gameSF2 = signal<GameData|undefined>(undefined);
  game3rd = signal<GameData|undefined>(undefined);
  gameFinal = signal<GameData|undefined>(undefined);

  nbTeam = computed<number>(() => {
    if (!this.group() || !this.divisionDraw()) return 0;
    const group = this.group()!;
    const step: Step|undefined = this.divisionDraw()!.steps
      .find(step => step.groups.find(grp => grp.id === group!.id));
    return step ? step.drawType.groups[group.position].nbTeams : 0;
  });

  protected assignGameData(gameData: GameData) {
    if (gameData.drawGame.round === 1) {
      switch(getGameIndex(gameData.drawGame.what)) {
        case 1: this.gameQF1.set(gameData); break;
        case 2: this.gameQF2.set(gameData); break;
        case 3: this.gameQF3.set(gameData); break;
        case 4: this.gameQF4.set(gameData); break;
      }
    } else if (gameData.drawGame.round === 2) {
      if (getGameIndex(gameData.drawGame.what) === 1) { // semi final 1
        this.gameSF1.set(gameData);
      } else { // semi final 2
        this.gameSF2.set(gameData);
      }
    } else if (gameData.drawGame.round === 3) {
      if (isFinal(gameData.drawGame.what)) {
        this.gameFinal.set(gameData);
      } else {
        this.game3rd.set(gameData);
      }
    }
  }
}
