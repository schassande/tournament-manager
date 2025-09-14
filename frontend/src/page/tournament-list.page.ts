import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { map, Observable } from 'rxjs';
import { Country, Region, Tournament } from '@tournament-manager/persistent-data-model';
import { TournamentService } from '../service/tournament.service';
import { DateService } from '../service/date.service';
import { RegionService } from '../service/region.service';
import { Table, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { AsyncPipe } from '@angular/common';
import { ConfirmationService } from 'primeng/api';
import { MultiSelectModule } from 'primeng/multiselect';
import { FormsModule } from '@angular/forms';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { ToggleSwitchModule } from "primeng/toggleswitch";
import { FilterService } from 'primeng/api';
import { SelectModule } from 'primeng/select';

@Component({
  standalone: true,
  imports: [AsyncPipe, ButtonModule, ConfirmDialogModule, FormsModule, IconFieldModule, InputIconModule,
    MultiSelectModule, SelectModule, TableModule, ToggleSwitchModule],
  template: `
    <div>
      <p-button label="New Tournament" (click)="createTournament()"/>
      @let ts = tournaments | async;
      @if(ts) {
        <p-table #dt1 [value]="ts" [tableStyle]="{ 'min-width': '50rem' }" size="small"
          [paginator]="true" [rows]="20"  showGridlines stripedRows
          selectionMode="single" [(selection)]="selectedTournament" (onRowSelect)="onTournamentSelected()"
          [globalFilterFields]="['name', 'regionId', 'countryId', 'startDateDate', 'endDateDate', 'nbDay']"
          [filters]="filters" (filtersChange)="onFilterChange($event)">

          <ng-template #caption>
            <div class="flex gap-2" style="text-align: center;">
              <!-- Nom -->
              <span style="margin-right: 20px;">
                <input pInputText type="text" (input)="applyFilter($event.target.value, 'name')" placeholder="Search by name"/>
                <i class="pi pi-search" style="margin-left: 5px;"></i>
              </span>
              <span style="margin-right: 20px;">
                <label>Duration:</label>
                <p-select style="margin-left: 5px;" [options]="nbDayOptions" optionLabel="label" optionValue="value" (onChange)="applyNbDayFilter($event.value)"></p-select>
              </span>
              <span style="margin-right: 20px;">
                <label>when:</label>
                <p-select style="margin-left: 5px;" [options]="dateOptions" optionLabel="label" optionValue="value" (onChange)="applyDateFilter($event.value)"></p-select>
              </span>
              <p-button label="Clear" [outlined]="true" icon="pi pi-filter-slash" (click)="clear(dt1)" />
            </div>
          </ng-template>

          <ng-template #header>
            <tr>
                <th pSortableColumn="regionId" style="width:15%; text-align: center;">
                  Region
                  <p-columnFilter field="regionId" matchMode="in" display="menu" [showMatchModes]="false"
                    [showOperator]="false" [showAddButton]="false">
                    <ng-template #filter let-value let-filter="filterCallback">
                        <p-multiselect [ngModel]="value" [options]="regions" placeholder="Any"
                          (onChange)="filter($event.value)" optionLabel="name" optionValue="id">
                        </p-multiselect>
                    </ng-template>
                  </p-columnFilter>
                </th>
                <th pSortableColumn="countryId" style="width:15%; text-align: center;">
                  Country
                  <p-columnFilter field="countryId" matchMode="in" display="menu" [showMatchModes]="false"
                    [showOperator]="false" [showAddButton]="false">
                    <ng-template #filter let-value let-filter="filterCallback">
                        <p-multiselect [ngModel]="value" [options]="countries" placeholder="Any"
                          (onChange)="filter($event.value)" optionLabel="name" optionValue="id">
                        </p-multiselect>
                    </ng-template>
                  </p-columnFilter>
                </th>
                <th style="width:30%; text-align: center;">Name</th>
                <th style="width:20%; text-align: center;">Begin date</th>
                <th style="width:10%; text-align: center;">Nb Days</th>
                <th style="width:10%; text-align: center;">Action</th>
            </tr>
          </ng-template>
          <ng-template #body let-tournament>
            <tr [pSelectableRow]="tournament">
              <td>{{ tournament.region?.name }}</td>
              <td>{{ tournament.country?.name }}</td>
              <td>{{ tournament.name }}</td>
              <td style="text-align: center;">{{ tournament.startDateStr }}
                @if (tournament.days.length > 1) {
                  >> {{ tournament.endDateStr }}
                }
              </td>
              <td style="text-align: center;">{{ tournament.days.length }}</td>
              <td style="text-align: center;">
                <i class="pi pi-cog action action-edit"      aria-label="Edit tournament"   title="Edit tournament"        (click)="editTournament(tournament, $event)"></i>
                <i class="pi pi-trash action action-remove"  aria-label="Remove tournament" title="Remove this tournament" (click)="removeTournament(tournament, $event)"></i>
              </td>
            </tr>
          </ng-template>
        </p-table>
        <button (click)="refreshFilter()">Refresh</button>
        <div>Filter: <span [innerHTML]="filterStr"></span></div>
      }
      <p-confirmdialog />
    </div>
  `,
  styles: [`
    .action {font-size: 1.2rem; margin-right: 10px; cursor: pointer; }
    .action-edit {  color: blue; }
    .action-remove { color: red; }
  `],
})
export class TournamentListComponent implements OnInit {
  readonly nbDayOptions = [
    { label: 'All',        value: null },
    { label: '1 day',      value: 1    },
    { label: 'Multi days', value: 2    }
  ];
  readonly dateOptions = [
    { label: 'All',     value: null      },
    { label: 'Past',    value: 'past'    },
    { label: 'Current', value: 'current' },
    { label: 'Next',    value: 'future'  }
  ];
  readonly STORAGE_KEY = 'tournament-list.filters';

  private tournamentService = inject(TournamentService);
  private confirmationService = inject(ConfirmationService);
  private filterService = inject(FilterService);
  private router = inject(Router);
  private dateService = inject(DateService);
  private regionService = inject(RegionService);

  selectedTournament: Tournament|undefined = undefined;
  regions: Region[] = this.regionService.regions;
  countries: Country[] = this.regionService.countries;
  filters: any = {};
  filterStr: string = '';
  tournaments: Observable<TournamentView[]> = this.tournamentService.all().pipe(
    map((tournaments: Tournament[]) => {
      return tournaments.map((tournament: Tournament) => {
        const tv: TournamentView = {...tournament,
          startDateStr: this.dateService.toDateStr(tournament.startDate, 'YYYY/MM/DD'),
          endDateStr: this.dateService.toDateStr(tournament.endDate, 'YYYY/MM/DD'),
          startDateDate: this.dateService.epochToDate(tournament.startDate),
          endDateDate: this.dateService.epochToDate(tournament.endDate),
          region: this.regionService.regionById(tournament.regionId),
          country: this.regionService.countryById(tournament.countryId)
        };
        tv.nbDay = tv.days.length;
        return tv;
      });
    })
  );

  ngOnInit() {
    // Load saved filters from localStorage
    // const savedFilters = localStorage.getItem(this.STORAGE_KEY);
    // this.filters = savedFilters ? JSON.parse(savedFilters) : {};

    this.filterService.register('pastTournament', this.pastTournament.bind(this));
    this.filterService.register('currentTournament', this.currentTournament.bind(this));
    this.filterService.register('futureTournament', this.futureTournament.bind(this));
  }

  pastTournament(tournament: TournamentView): boolean {
    const today = this.dateService.dateToEpoch(new Date());
    console.log('pastTournament', tournament?.endDate, today);
    if (!tournament?.endDate) return false;
    return tournament.endDate < today;
  }
  currentTournament(tournament: TournamentView): boolean {
    const today = this.dateService.dateToEpoch(new Date());
    const end = this.dateService.addDay(tournament?.startDate, tournament?.nbDay + 1)
    console.log('currentTournament', tournament.startDate, today, end);
    if (!tournament?.startDate || !tournament?.endDate) return false;
    return tournament.startDate <= today && today <= end;
  }
  futureTournament(tournament: TournamentView): boolean {
    const today = this.dateService.dateToEpoch(new Date());
    console.log('futureTournament', tournament?.startDate, today);
    if (!tournament?.startDate) return false;
    return today < tournament.startDate;
  }

  applyFilter(value: any, field: string) {
    console.log('applyFilter: ', value, field)
    if (value) {
      this.filters[field] = { value, matchMode: 'equals' };
    } else {
      delete this.filters[field];
    }
    this.onFilterChange(this.filters);
  }

  applyNbDayFilter(value: number | null) {
    console.log('applyNbDayFilter: ', value)
    if (value === 1) {
      this.filters['nbDay'] = [{ value: 1, matchMode: 'equals' }];
    } else if (value === 2) {
      this.filters['nbDay'] = [{ value: 1, matchMode: 'greaterThan' }];
    } else {
      delete this.filters['nbDay'];
    }
    this.onFilterChange(this.filters);
  }

  applyDateFilter(value: string | null) {
    if (value === 'past') {
      this.filters['startDateDate'] = [{ value: true, matchMode: 'pastTournament' }];
    } else if (value === 'current') {
      this.filters['startDateDate'] = [{ value: true, matchMode: 'currentTournament' }];
    } else if (value === 'future') {
      this.filters['startDateDate'] = [{ value: true, matchMode: 'futureTournament' }];
    } else {
      delete this.filters['startDateDate'];
    }
    this.onFilterChange(this.filters);
  }
  onFilterChange(event: any) {
    this.filters = event;
    console.log('onFilterChange: ', this.filters);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.filters));
    this.refreshFilter();
  }
  onFilter(event: any) {
    console.log('onFilter: ', event);
  }

  refreshFilter() {
    this.filterStr = '<p>' + JSON.stringify(this.filters, null, 2) + '</p>';
  }

  clear(table: Table) {
    this.filters = {};
    this.refreshFilter();
    localStorage.removeItem(this.STORAGE_KEY);
    table.clear();
  }

  createTournament() {
    this.router.navigate(['/tournament/create']);
  }

  onTournamentSelected() {
    if (this.selectedTournament) {
      console.debug('Selected tournament: ', this.selectedTournament);
      this.router.navigate([`/tournament/${this.selectedTournament.id}/home`]);
    }
  }

  editTournament(tournament: Tournament, $event: MouseEvent) {
    $event.stopPropagation(); // Prevent row selection
    this.router.navigate(['/tournament', tournament.id, 'edit']);
  }

  removeTournament(tournament: Tournament, $event: MouseEvent) {
    $event.stopPropagation(); // Prevent row selection
    console.debug('Remove tournament: ', tournament);
    this.confirmationService.confirm({
      message: 'Do you want to delete the tournament '+tournament.name+'?',
      header: 'Confirmation',
      icon: 'pi pi-exclamation-triangle',
      rejectLabel: 'Cancel',
      acceptLabel: 'Delete',
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true},
      acceptButtonProps: { label: 'Delete', severity: 'danger'},
      accept: () => {
        // The user confirm to remove the tournament
        this.tournamentService.delete(tournament.id).then(() => {
          console.log(`Tournament ${tournament.name} deleted.`);
        }).catch(err => {
          console.error('Error deleting tournament: ', err);
        });
        this.confirmationService.close();
      },
      reject: () => {
        // The user choose to not remove player referees
        this.confirmationService.close();
      },
    });
  }
}

export interface TournamentView extends Tournament {
  startDateStr: string;
  endDateStr: string;
  startDateDate: Date;
  endDateDate: Date;
  region: Region|undefined;
  country: Country|undefined;
}
