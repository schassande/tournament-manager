import { Component, computed, inject, input, signal } from "@angular/core";
import { Division, DivisionDraw, Game, Group, SpecificDataPool, Team, TeamPoint, Tournament } from "@tournament-manager/persistent-data-model";
import { DrawCupService } from "../../service/draw/draw-cup.service";
import { DivisionDrawService } from "../../service/draw/division-draw.service";

/** Displays the match planning grouped by referee coach. */
@Component({
  selector: 'app-draw-pool',
  template: `
    <table class="draw">
      <thead>
          <tr>
            <th>Rank</th>
            <th>Name</th>
            <th>Points</th>
            <th>Played</th>
            <th>Win</th>
            <th>Draw</th>
            <th>Lost</th>
            <th>GA</th>
          </tr>
      </thead>
      <tbody>
        @for(teamPointData of teamsPointDatas(); track teamPointData.teamName) {
          <tr>
            <td>{{teamPointData.teamsPoint.rank}}</td>
            <td class="team-col">{{teamPointData.teamName}}</td>
            <td>{{teamPointData.teamsPoint.points}}</td>
            <td>{{teamPointData.teamsPoint.played}}</td>
            <td>{{teamPointData.teamsPoint.win}}</td>
            <td>{{teamPointData.teamsPoint.draw}}</td>
            <td>{{teamPointData.teamsPoint.lost}}</td>
            <td>{{teamPointData.teamsPoint.goalAverage}}</td>
          </tr>
        }
      </tbody>
    </table>
  `,
  styles: [
    `.draw { 
      border-collapse: collapse; 
      th { background: var(--p-surface-100); }
      th,  td {
        border: 1px solid var(--p-content-border-color);
        padding: 0.5rem;
        text-align: center;
        white-space: nowrap;
      }
      .team-col { text-align: left; }
    }
    `
  ],
  imports: [],
})
export class DrawPoolComponent {
  divisionDrawService = inject(DivisionDrawService);
  drawCupService = inject(DrawCupService);

  group = input<Group|undefined>(undefined);
  divisionId = input<string|undefined>(undefined);
  tournament = input<Tournament|undefined>(undefined);
  divisionDraw = input<DivisionDraw|undefined>(undefined);

  teamsPointDatas = computed<TeamPointData[]|undefined>(() => 
   this.divisionDrawService.getOrCreateTeamPoints(this.group()).map(teamsPoint => {
      const division: Division = this.tournament()!.divisions.find(div => div.id === this.divisionId())!;
      return {
        teamsPoint,
        teamName: this.drawCupService.teamLabel(teamsPoint.team, this.divisionDraw()!, division)
      };
    })
  );
}
interface TeamPointData {
  teamsPoint: TeamPoint;
  teamName: string;
}
