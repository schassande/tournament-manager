import { Component, computed, inject, input } from '@angular/core';
import {
  Division,
  DivisionDraw,
  Game,
  Group,
  SpecificDataPool,
  Tournament,
} from '@tournament-manager/persistent-data-model';
import { DrawCupService } from '../../service/draw/draw-cup.service';

/** Displays the match planning grouped by referee coach. */
@Component({
  selector: 'app-draw-wins',
  template: `
    <table class="draw">
      <thead>
        <tr>
          <td>Name</td>
          <td># Win</td>
        </tr>
      </thead>
      <tbody>
        @for (teamData of teamDatas(); track teamData.teamName) {
          <tr>
            <td class="team-col">{{ teamData.teamName }}</td>
            <td>{{ teamData.win }}</td>
          </tr>
        }
      </tbody>
    </table>
  `,
  styles: [
    `
      .team-col {
        width: 15 rem;
      }
    `,
  ],
  imports: [],
})
export class DrawWinsComponent {
  private drawCupService = inject(DrawCupService);

  group = input<Group | undefined>(undefined);
  divisionId = input<string | undefined>(undefined);
  tournament = input<Tournament | undefined>(undefined);
  divisionDraw = input<DivisionDraw | undefined>(undefined);
  games = input<Game[] | undefined>(undefined);

  teamDatas = computed<TeamData[]>(() => {
    if (!this.group() || !this.divisionDraw() || !this.tournament() || !this.divisionId()) return [];
    const division: Division = this.tournament()!.divisions.find((div) => div.id === this.divisionId())!;
    return this.group()!.teams.map((teamRef) => {
      const win: number = 0;
      if (teamRef.teamId) {
        this.games()!.map((game) => {
          if (game.score) {
            if (game.awayTeamId === teamRef.teamId) {
              return game.score.awayTeamScore > game.score.homeTeamScore ? 1 : 0;
            } else if (game.homeTeamId === teamRef.teamId) {
              return game.score.homeTeamScore > game.score.awayTeamScore ? 1 : 0;
            }
          }
          return 0;
        });
      }
      return {
        teamName: this.drawCupService.teamLabel(teamRef, this.divisionDraw()!, division),
        win,
      };
    });
  });
}
interface TeamData {
  teamName: string;
  win: number;
}
