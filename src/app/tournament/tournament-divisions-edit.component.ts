import { Component, computed, model } from '@angular/core';
import { Division } from '../shared/data.model';
import { max } from 'rxjs';

@Component({
  selector: 'app-tournament-divisions-edit',
  template: `
  <div class="divisionTable">
  <p-table [value]="allTeamsArray()" stripedRows
    showGridlines [size]="'small'" tableLayout="fixed">
    <ng-template #header>
        <tr class="tableRowTitle1">
          @for(division of divisions(); track division.id) {
            <th>{{division.name}}</th>
          }
        </tr>
        <tr class="tableRowTitle2">
          @for(division of divisions(); track division.id) {
            <th>{{division.shortName}}</th>
          }
        </tr>
    </ng-template>
    <ng-template #body let-rowData>
        <tr class="tableRowItem">
          @for(division of divisions(); track division.id; let idx = $index) {
            <td>{{rowData[idx]}}</td>
          }
        </tr>
    </ng-template>
  </p-table>
  </div>`,
  styles: [''],
  standalone: false
})
export class TournamentDivisionsEditComponent {

  divisions = model.required<Division[]>()

  allTeamsArray = computed(() => {
    const divisions = this.divisions();
    // calcul le nombre maximum d'équipe dans les divisions
    const maxTeams = Math.max(...divisions.map(d => d.teams.length));
    // create an array with teams names
    const result:string[][] = [];
    for(let rowIdx = 0; rowIdx<maxTeams; rowIdx++) {
      result.push(divisions.map(d => {
        return rowIdx < d.teams.length ? d.teams[rowIdx].name: '';
      }))
    }
    console.log(result);
    return result;
  });

  addDivision() {
  }
  removeDivision(divisionId: string) {

  }
  onPaste(event:any, rowIdx:number) {

  }
}
