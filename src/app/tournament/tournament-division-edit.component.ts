import { Component, effect, input, model, output } from '@angular/core';
import { BasicDivision, BasicDivisions, Division, Team, Tournament } from '../shared/data.model';

@Component({
  selector: 'app-tournament-division-edit',
  template: `
    <p-table #divisionTable [tableStyle]="{ 'width': '400px',  'margin-bottom': '5px' }"showGridlines [size]="'small'" tableLayout="fixed">
      <ng-template #header>
        <tr>
          <th class="headerColName">Division Name</th>
          <th class="headerColShortName">Short</th>
          <th style="text-align: center;" (click)="removeDivision()">
            <i class="pi pi-trash action action-remove"  aria-label="remove division"></i>
          </th>
        </tr>
      </ng-template>
      <ng-template #footer>
        <tr>
          <td [pEditableColumn]="division().name" pEditableColumnField="name" style="text-align: center;">
            <p-cellEditor>
              <ng-template #input>
              <p-select id="{{division().id}}" inputId="division{{division().id}}" size="small"
                [options]="divisionNames" [(ngModel)]="selectedDivisionName" appendTo="body"
                [editable]="true" placeholder="Division name" maxlength="20"
                (onChange)="divisionNameSelected($event.value)" />
              </ng-template>
              <ng-template #output>{{ division().name }}</ng-template>
            </p-cellEditor>
          </td>
          <td [pEditableColumn]="division().shortName" pEditableColumnField="shortName" style="text-align: center;">
            <p-cellEditor>
              <ng-template #input><input pInputText type="text" [(ngModel)]="division().shortName" minlength ="5"/></ng-template>
              <ng-template #output style="text-align: center;">{{ division().shortName }}</ng-template>
            </p-cellEditor>
          </td>
          <td></td>
        </tr>
      </ng-template>
    </p-table>
    <p-table [value]="division().teams" stripedRows [tableStyle]="{ 'width': '400px' }"
      tableStyleClass="tableStyle"
      showGridlines [size]="'small'" tableLayout="fixed">
      <ng-template #header>
          <tr>
            <th class="headerColName">Team Name</th>
            <th class="headerColShortName">Short</th>
            <th (click)="addTeam()"><i class="pi pi-plus action action-add" aria-label="add a new team"></i></th>
          </tr>
      </ng-template>
      <ng-template #body let-team let-ri=rowIndex>
          <tr class="tableRowItem">
            <td [pEditableColumn]="team.name" pEditableColumnField="name">
              <p-cellEditor>
                <ng-template #input><input pInputText type="text" [(ngModel)]="team.name" (paste)="onPasteTeamNames($event, ri)" maxlength="30" /></ng-template>
                <ng-template #output>{{ team.name }}</ng-template>
              </p-cellEditor>
            </td>
            <td [pEditableColumn]="team.shortName" pEditableColumnField="shortName" style="text-align: center;">
              <p-cellEditor>
                <ng-template #input><input pInputText type="text" [(ngModel)]="team.shortName" (paste)="onPasteTeamShortNames($event, ri)"  maxlength="10"/></ng-template>
                <ng-template #output style="text-align: center;">{{ team.shortName }}</ng-template>
              </p-cellEditor>
            </td>
            <td style="text-align: center;" (click)="removeTeam(team)">
              <i class="pi pi-trash action action-remove"  aria-label="remove division"></i>
            </td>
          </tr>
      </ng-template>
    </p-table>
  `,
  styles: [`
    .headerColName { text-align: center;width:60% }
    .headerColShortName { text-align: center;width:40% }
    .action { font-size: 1rem; margin: 0 5px; }
    .action-remove { color: red; }
    .action-add { color: green; }
  `],
  standalone: false
})
export class TournamentDivisionEditComponent {

  tournament = input.required<Tournament>();
  division = model.required<Division>();
  divisionRemoved = output<Division>();
  divisionchanged = output<Division>();
  divisionNames: string[] = BasicDivisions.map(bd => bd.name);
  selectedDivisionName: string = '';

  constructor() {
    effect(() => {
      this.selectedDivisionName = this.division().name;
    });
  }
  divisionNameSelected(newDivisionName:string) {
    this.selectedDivisionName = newDivisionName;
    this.division.update(d => {
      d.name = newDivisionName;
      const bd = BasicDivisions.find(bd => bd.name === newDivisionName);
      if (bd) {
        d.shortName = bd.shortName;
      }
      return d;
    });
  }
  removeDivision() {
    this.divisionRemoved.emit(this.division());
  }

  onDivisionNamechange(divisionName: string) {
    this.division.update(division => {
      division.name = divisionName;
      division.teams.forEach(team => team.divisionName = divisionName);
      this.divisionchanged.emit(division);
      return division;
    });
  }

  onDivisionShortNamechange(divisionShortName: string) {
    this.division.update(division => {
      division.shortName = divisionShortName;
      this.divisionchanged.emit(division);
      return division;
    });
  }
  onTeamNamechange(teamId: string, teamName: string) {
    this.division.update(division => {
      const team = division.teams.find(t => t.id === teamId);
      if (team) {
        team.name = teamName;
        this.divisionchanged.emit(division);
      }
      return division;
    });
  }
  onTeamShortNamechange(teamId: string, teamShortName: string) {
    this.division.update(division => {
      const team = division.teams.find(t => t.id === teamId);
      if (team) {
        team.shortName = teamShortName;
        this.divisionchanged.emit(division);
      }
      return division;
    });
  }
  addTeam() {
    this.division.update(division => {
      if (division.teams.length >= 99) return division;
      const existingTeamNames: ExistingTeamNames = this.getExistingTeamNames();
      const teamId = this.computeAvailableId(division, existingTeamNames);
      const team: Team = {
        id: teamId,
        divisionName: division.name,
        name: 'Team '+teamId,
        shortName: 'T'+teamId,
        players: []
      };
      division.teams.push(team);
      this.divisionchanged.emit(division);
      return division;
    });
  }

  removeTeam(teamId: string) {
    this.division.update(division => {
      if (division.teams.length < 2) return division;
      const idx = division.teams.findIndex(t => t.id === teamId);
      if (idx < 0) return division;
      division.teams.splice(idx, 1);

      this.divisionchanged.emit(division);
      return division;
    });
  }

  onPasteTeamNames(event: ClipboardEvent, rowIndex: number) {
    event.preventDefault(); // Empêcher le collage natif

    const clipboardData = event.clipboardData || (window as any).clipboardData;
    const pastedText = clipboardData.getData('text'); // Récupérer le texte collé
    if (pastedText) {
      this.division.update(division => {
        // parse clipboard and filter values
        const rows: string[][] = pastedText.split('\n')
          .filter((r:string) => r.trim() !== '')
          .map((r:string) => r.split('\t').filter(c => c.trim().length > 0))
          .filter((r:string[]) => r.length > 0 && r[0].trim().length > 0)

        rows.forEach((row:string[],idx:number) => {
          const existingTeamNames: ExistingTeamNames = this.getExistingTeamNames();
          const teamId = this.computeAvailableId(division, existingTeamNames);

          // inject new team
          const targetIdx = rowIndex + idx;
          if (targetIdx < division.teams.length) {
            if (row.length>0) {
              division.teams[targetIdx].name = row[0];
              if (row.length>1) {
                division.teams[targetIdx].shortName = row[1];
              }
            }
          } else {
            // add a new team in last position
            division.teams.push({
              id: teamId,
              divisionName: division.name,
              name: row.length>0 ? row[0] : 'Team '+teamId,
              shortName: row.length>1 ? row[1] : 'T'+teamId,
              players: []
            });
          }
        });

        this.divisionchanged.emit(division);
        return division;
      })
    }
  }
  onPasteTeamShortNames(event: ClipboardEvent, rowIndex: number) {
    event.preventDefault(); // Empêcher le collage natif

    const clipboardData = event.clipboardData || (window as any).clipboardData;
    const pastedText = clipboardData.getData('text'); // Récupérer le texte collé
    if (pastedText) {
      this.division.update(division => {
        // parse clipboard and filter values
        const rows: string[][] = pastedText.split('\n')
          .filter((r:string) => r.trim() !== '')
          .map((r:string) => r.split('\t').filter(c => c.trim().length > 0))
          .filter((r:string[]) => r.length > 0 && r[0].trim().length > 0)

        rows.forEach((row:string[],idx:number) => {
          const existingTeamNames: ExistingTeamNames = this.getExistingTeamNames();
          const teamId = this.computeAvailableId(division, existingTeamNames);

          const targetIdx = rowIndex + idx;
          if (targetIdx < division.teams.length) {
            if (row.length>0) {
              division.teams[targetIdx].shortName = row[0];
            }
          } else {
            // add a new team in last position
            division.teams.push({
              id: teamId,
              divisionName: division.name,
              name: 'Team '+teamId,
              shortName: row.length>0 ? row[0] : 'T'+teamId,
              players: []
            });
          }
        });

        this.divisionchanged.emit(division);
        return division;
      })
    }
  }
  private getExistingTeamNames(): ExistingTeamNames {
    const etn: ExistingTeamNames = { teamIds: [], teamNames:[], teamShortNames: [] };
    this.tournament().divisions.forEach(d => {
        d.teams.forEach(t => {
          etn.teamIds.push(t.id);
          etn.teamNames.push(t.name);
          etn.teamShortNames.push(t.shortName);
        });
      });
    return etn;
  }
  private computeAvailableId(division: Division, existingTeamNames: ExistingTeamNames): string {
    let i = Number.parseInt(division.id);
    let str: string;
    do {
      i++;
      str = i.toString();
    } while(existingTeamNames.teamIds.findIndex(v => v === str) >= 0);
    return str;
  }
}
interface ExistingTeamNames {
  teamIds: string[];
  teamNames: string[];
  teamShortNames: string[];
}
