import { DivisionDraw, DrawGame, Game, Group, Tournament } from "@tournament-manager/persistent-data-model";
import { GameData } from "./draw-game-cell.component";
import { DrawCupService } from "../../service/draw/draw-cup.service";
import { Directive, effect, inject, input } from "@angular/core";

@Directive()
export abstract class AbstractDrawCupComponent {
  protected drawCupService = inject(DrawCupService);
  group = input<Group|undefined>(undefined);
  divisionId = input<string|undefined>(undefined);
  tournament = input<Tournament|undefined>(undefined);
  divisionDraw = input<DivisionDraw|undefined>(undefined);
  games = input<Game[]>([]);

  constructor() {
    effect(() => this.updateGameDatas());
  }
  protected updateGameDatas() {
    if (this.group() 
      && this.tournament() 
      && this.divisionId() 
      && this.games().length > 0 ) {
      
      this.initGameDataStructure(this.group()!);

      this.group()?.games.forEach(drawGame => {
        this.assignGameData(this.buildGameData(drawGame, 
          this.divisionId()!, 
          this.tournament()!,
          this.divisionDraw()!, 
          this.games()!));
      });
    }
  }
  protected initGameDataStructure(group: Group): void {}
  protected abstract assignGameData(gameData: GameData): void;

  protected buildGameData(
    drawGame: DrawGame,
    divisionId: string,
    tournament: Tournament,
    divisionDraw: DivisionDraw,
    games: Game[]): GameData {

    const gameData: GameData = { drawGame,  division: tournament.divisions.find(div => div.id === divisionId)! };
    
    if (drawGame.gameId) {
      const game: Game|undefined = games.find(game => game.id === drawGame.gameId);
      if (game) {
        gameData.game = game;
        gameData.day = tournament.days.find(day => day.id === game.dayId);
        gameData.timeSlot = gameData.day!.parts.map(part => part.timeslots).flat().find(ts => ts.id === game.timeslotId);
        gameData.field = tournament.fields.find(field => field.id === game.fieldId);
        gameData.homeTeamName = this.drawCupService.teamLabel(drawGame.homeTeam, divisionDraw, gameData.division);
        gameData.awayTeamName = this.drawCupService.teamLabel(drawGame.awayTeam, divisionDraw, gameData.division);
      }
    }
    return gameData;
  }
}
