import { RegionService } from 'src/app/shared/services/region.service';
import { map, Observable } from 'rxjs';
import { Country, Region, Tournament } from './../shared/data.model';
import { TournamentService } from './../shared/services/tournament.service';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DateService } from 'src/app/shared/services/date.service';

@Component({
  standalone: false,
  selector: 'app-tournament-list',
  template: `
    <div>
      <p-button label="New Tournament" (click)="createTournament()"/>
      @let ts = tournaments | async;
      @if(ts) {
        <p-table [value]="ts" [tableStyle]="{ 'min-width': '50rem' }" size="small" showGridlines stripedRows
        [paginator]="true" [rows]="10" selectionMode="single" [(selection)]="selectedTournament"
        (onRowSelect)="onTournamentSelected()">
          <ng-template #header>
              <tr>
                  <th>Region</th>
                  <th>Country</th>
                  <th>Name</th>
                  <th pSortableColumn="code">Begin date <p-sortIcon field="startDate" /></th>
                  <th>Nb days</th>
                  <th></th>
              </tr>
          </ng-template>
          <ng-template #body let-tournament>
              <tr [pSelectableRow]="tournament">
                <td>{{ tournament.region?.name }}</td>
                <td>{{ tournament.country?.name }}</td>
                <td>{{ tournament.name }}</td>
                <td>{{ tournament.startDateStr }}</td>
                <td>{{ tournament.days.length }}</td>
                <td>
                  <i class="pi pi-cog"  aria-label="edit tournament" (click)="editTournament(tournament)"></i>
                </td>
              </tr>
          </ng-template>
        </p-table>
      }
    </div>
  `,
  styles: [``],
})
export class TournamentListComponent {

  private tournamentService = inject(TournamentService);
  private router = inject(Router);
  dateService = inject(DateService);
  regionService = inject(RegionService);
  selectedTournament: Tournament|undefined = undefined;

  tournaments: Observable<TournamentView[]> = this.tournamentService.all().pipe(
    map((tournaments: Tournament[]) => {
      return tournaments.map((tournament: Tournament) => {
        const tv: TournamentView = {...tournament,
          startDateStr: this.dateService.toDateStr(tournament.startDate, 'YYYY/MM/DD'),
          endDateStr: this.dateService.toDateStr(tournament.endDate, 'YYYY/MM/DD'),
          region: this.regionService.regionById(tournament.regionId),
          country: this.regionService.countryById(tournament.countryId)
        };
        return tv;
      });
    })
  );

  createTournament() {
    this.router.navigate(['/tournament/create']);
  }

  onTournamentSelected() {
    if (this.selectedTournament) {
      this.router.navigate(['/tournament', this.selectedTournament.id, 'home']);
    }
  }

  editTournament(tournament: Tournament) {
    this.router.navigate(['/tournament', tournament.id, 'edit']);
  }
}

export interface TournamentView extends Tournament {
  startDateStr: string;
  endDateStr: string;
  region: Region|undefined;
  country: Country|undefined;
}
