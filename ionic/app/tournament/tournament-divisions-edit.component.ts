import { Tournament, BasicDivision, BasicDivisions } from './../shared/data.model';
import { Component, computed, effect, model, output, signal } from '@angular/core';
import { Division } from '../shared/data.model';

@Component({
  selector: 'app-tournament-divisions-edit',
  template: `
  <div class="divisionsTable">
    @for(division of divisions(); track division.id) {
      <p-card class="divisionBlock">
        <app-tournament-division-edit [division]="division" [tournament]="tournament()"
          (divisionchanged)="onDivisionChanged(division)"
          (divisionRemoved)="removeDivision($event.id)"
          ></app-tournament-division-edit>
      </p-card>
    }
    <p-card class="addBlock" (click)="addDivision()">
      <i class="pi pi-plus  action-add" aria-label="add day"></i>
    </p-card>
  </div>`,
  styles: [`
    .divisionsTable { }
    .addBlock,
    .divisionBlock {
      display: inline-block;
      vertical-align: top;
      padding: 5px;
      margin: 5px;
    }
    `],
  standalone: false
})
export class TournamentDivisionsEditComponent {
  tournament = model.required<Tournament>();
  divisions = signal<Division[]>([]);
  divisionsChanged = output<Division[]>();

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
  constructor() {
    effect(() =>{
      this.divisions.set(this.tournament()!.divisions);
    })
  }

  addDivision() {
    this.tournament.update(tournament => {
      const bd = this.computeBasicDivision(tournament);
      tournament.divisions.push({
        id: this.computeDivisionId(tournament),
        name: bd.name,
        shortName: bd.shortName,
        backgroundColor: bd.backgroundColor,
        fontColor: bd.fontColor,
        teams: []
      });
      this.divisionsChanged.emit(tournament.divisions);
      return tournament;
    });
  }
  removeDivision(divisionId: string) {
    this.tournament.update(tournament => {
      const idx = tournament.divisions.findIndex(d => d.id === divisionId);
      if (idx >= 0) {
        console.debug('remove division', divisionId, 'at', idx)
        tournament.divisions.splice(idx, 1);
      }
      this.divisionsChanged.emit(tournament.divisions);
      return tournament;
    });
  }
  onDivisionChanged(division:Division) {
    this.tournament.update(tournament => {
      const idx = tournament.divisions.findIndex(d => d.id === division.id);
      if (idx < 0) return tournament;
      tournament.divisions[idx] = division;
      this.divisionsChanged.emit(tournament.divisions);
      return tournament;
    });
  }
  private computeDivisionId(tournament: Tournament): string {
    let i = 0;
    let str: string;
    do {
      i+=100;
      str = i.toString();
    } while(tournament.divisions.findIndex(d => d.id === str) >= 0);
    return str;
  }
  private computeBasicDivision(tournament: Tournament): BasicDivision {
    let i = 0;
    let bd: BasicDivision = { name: '', shortName: '', backgroundColor: '', fontColor: ''};
    do {
      i++;
      bd = BasicDivisions[i];
    } while(tournament.divisions.findIndex(d => d.name === bd.name || d.shortName === bd.shortName) >= 0);
    return bd;
  }
}
