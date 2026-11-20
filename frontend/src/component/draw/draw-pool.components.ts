import { Component, computed, input, signal } from "@angular/core";
import { Division, DivisionDraw, Game, Group, SpecificDataPool, Team, TeamPoint, Tournament } from "@tournament-manager/persistent-data-model";
import { teamLabel } from "../../service/draw-cup.service";

/** Displays the match planning grouped by referee coach. */
@Component({
  selector: 'app-draw-pool',
  template: `
    <table class="draw">
      <thead>
          <tr>
            <td>Rank</td>
            <td>Name</td>
            <td>Points</td>
            <td>Played</td>
            <td>Win</td>
            <td>Draw</td>
            <td>Lost</td>
            <td>GA</td>
          </tr>
      </thead>
      <tbody>
        @for(teamPointData of teamsPointDatas(); track teamPointData.teamName) {
          <tr>
            <td>{{teamPointData.teamsPoint.rank}}</td>
            <td>{{teamPointData.teamName}}</td>
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
    `.team-col { width: 15 rem; }`
  ],
  imports: [],
})
export class DrawPoolComponent {
  group = input<Group|undefined>(undefined);
  divisionId = input<string|undefined>(undefined);
  tournament = input<Tournament|undefined>(undefined);
  divisionDraw = input<DivisionDraw|undefined>(undefined);

  teamsPointDatas = computed<TeamPointData[]|undefined>(() => 
    (this.group()?.specificData as SpecificDataPool)?.teamsPoints.map(teamsPoint => {
      const division: Division = this.tournament()!.divisions.find(div => div.id === this.divisionId())!;
      return {
        teamsPoint,
        teamName: teamLabel(teamsPoint.team, this.divisionDraw()!, division)
      };
    })
  );
}
interface TeamPointData {
  teamsPoint: TeamPoint;
  teamName: string;
}
