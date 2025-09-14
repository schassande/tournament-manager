import { Component, effect, inject, signal } from '@angular/core';
import { map, mergeMap } from 'rxjs';

import { Day, PartDay, TournamentRefereeAllocation, FragmentRefereeAllocation, RefereeCoach, FragmentRefereeAllocationDesc } from '@tournament-manager/persistent-data-model';
import { AbstractTournamentPage } from '../component/tournament-abstract.page';
import { DateService } from '../service/date.service';
import { TournamentRefereeAllocationService } from '../service/tournament-referee-allocation.service';
import { FragmentRefereeAllocationService } from '../service/fragment-referee-allocation.service';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { DatePipe } from '@angular/common';
import { RefereeAllocationService } from '../service/referee-allocation.service';
import { RefereeService } from '../service/referee.service';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';

@Component({
  selector: 'app-tournament-referees-allocation',
  imports: [ ButtonModule, CardModule, ConfirmDialogModule, DatePipe, DialogModule, FormsModule, InputTextModule, SelectModule],
  template: `
  <div style="height: 10px;">
  </div>
@if (tournamentAllocations().length === 0) {
  <div style="margin: 30px auto; text-align: center;">
    <div>Do you want to create a first allocation for the tournament?</div>
    <div (click)="createTournamentAllocation()" style="margin-top: 10px;">
      <i class="pi pi-plus action action-plus" aria-label="Create allocation" title="Create allocation"></i>Create
    </div>

  </div>
} @else {
  <p-confirmdialog />
  <p-dialog header="New allocation" [modal]="true" [(visible)]="modalCreateAllocation.show" [style]="{ width: '25rem' }">
      <span class="p-text-secondary block mb-8">Enter the allocation name:</span>
      <div class="flex items-center gap-4 mb-4" style="margin-top: 10px; text-align: center;">
          <input pInputText id="allocationName" [(ngModel)]="modalCreateAllocation.newAllocationName" class="flex-auto" autocomplete="off" required minlength="3"/>
      </div>
      <div class="flex justify-end gap-2" style="margin-top: 20px; text-align: right;">
          <p-button label="Cancel" severity="secondary" (click)="modalCreateAllocation.show = false" />
          <p-button label="Create" (click)="confirmAllocationCreation()"/>
      </div>
  </p-dialog>
  <table class="dayAllocationTable">
    <tr>
      <td colspan="2" class="noBorder"></td>
      <td colspan="10" style="text-align: center; font-weight: bold;">Tournament allocations</td>
    </tr>
    <tr class="title-row">
      <td colspan="2" class="noBorder"></td>
      @for(tAlloc of tournamentAllocations(); track tAlloc.data.id) {
        <th class="colAllocation {{tAlloc.data.current ? 'current-allocation' : ''}}">
          <div style="height: 30px; text-align: center">
            @if (tAlloc.data.current) {
            Selected
            } @else {
              <div (click)="toggleAllocationActivation(tAlloc.data)" class="action-item">
                <i class="pi pi-play action" aria-label="Set as current allocation" title="Set as current allocation"></i>Select
              </div>
            }
          </div>
          <div>
            <input type="text" pInputText [(ngModel)]="tAlloc.data.name" required
              (ngModelChange)="onTourAllocChanged(tAlloc.data)" pSize="small" style="width: 200px;" />
          </div>
          <div class="action-panel">
            <div class="action-row">
              <div (click)="createTournamentAllocation()" class="action-item">
                <i class="pi pi-plus action action-plus" aria-label="Create allocation" title="Create allocation"></i>
              </div>
              <div (click)="duplicateTournamentAllocation(tAlloc.data)" class="action-item">
                <i class="pi pi-copy action" aria-label="Duplicate allocation" title="Duplicate allocation"></i>
              </div>
              <div (click)="deleteTournamentAllocation(tAlloc.data)" class="action-item">
                <i class="pi pi-trash action" aria-label="Remove full day allocation" title="Remove full day allocation"></i>
              </div>
            </div>
          </div>
        </th>
      }
    </tr>
    @for(dayAllocation of dayAllocations(); track dayAllocation.day.id; let lastDay = $last) {
      <tr class="fullRow">
        <td style="text-align: center;"  [attr.rowspan]="dayAllocation.showParts ? dayAllocation.partRows.length+1 : 1">
          <div style="font-weight: bold;">Day {{dayAllocation.day.id}}</div>
          <div>{{dayAllocation.day.date | date:'EEEE'}}</div>
          <div>{{dayAllocation.dateStr}}</div>
        </td>
        <td>Full</td>
        @for(fav of dayAllocation.fullColumns; track fav.tournament.id) {
          <td class="colAllocation {{fav.tournament.current ? 'current-allocation' : ''}} {{!dayAllocation.showParts && lastDay ?'last-row':''}}">
            <div>
              <p-select [options]="fav.fragments" [(ngModel)]="fav.selected" optionLabel="data.name" placeholder="Select an allocation"
                (onChange)="selectFragmentAllocation(fav.tournament, $event.value)"
                style="width: 200px;" size="small" />
            </div>
            <div class="action-panel">
              @if (fav.fragments.length > 0 && fav.selected) {
                <div class="action-row">
                  <div (click)="routeToAllocationEdit(fav.tournament, fav.selected.data)" class="action-item">
                    <i class="pi pi-pencil action" aria-label="Duplicate allocation" title="Duplicate allocation"></i>
                  </div>
                  @if (fav.tournament.current) {
                    <div (click)="toggleFragmentAllocationVisibilty(fav.selected.data, fav.tournament, dayAllocation.day.id)" class="action-item">
                      @if(fav.selected.data.visible) {
                        <i class="pi pi-eye action" aria-label="Unpublish the allocation " ></i>
                      } @else {
                        <i class="pi pi-eye-slash action" aria-label="Publish the allocation" ></i>
                      }
                    </div>
                  }
                </div>
              }
              <div class="action-row">
                <div (click)="createFragmentAllocation(fav.tournament, dayAllocation.day.id)" class="action-item">
                  <i class="pi pi-plus action action-plus" aria-label="Create a new full day allocation" title="Create a new full day allocation"></i>
                </div>
                @if (fav.fragments.length > 0 && fav.selected) {
                  <div (click)="duplicateFragmentAllocation(fav.selected.data, fav.tournament, dayAllocation.day.id)" class="action-item">
                    <i class="pi pi-copy action" aria-label="Duplicate allocation" title="Duplicate allocation"></i>
                  </div>
                  <div (click)="deleteFragmentAllocation(fav.selected.data, fav.tournament, dayAllocation.day.id)" class="action-item">
                    <i class="pi pi-trash action" aria-label="Remove full day allocation" title="Remove full day allocation"></i>
                  </div>
                }
              </div>
            </div>
          </td>
        }
      </tr>
      @if(dayAllocation.showParts) {
        @for(partRow of dayAllocation.partRows; track partRow.partDay.id; let partDayIdx = $index; let lastPart = $last) {
          <tr class="partRow">
            <td>Part {{partRow.partDay.id}}</td>
            @for(fav of partRow.columns; track fav.tournament.id) {
              <td class="colAllocation {{fav.tournament.current ? 'current-allocation' : ''}} {{lastDay && lastPart?'last-row':''}}">
                <div>
                <p-select [options]="fav.fragments" [(ngModel)]="fav.selected" optionLabel="data.name" placeholder="Select an allocation"
                  (onChange)="selectFragmentAllocation(fav.tournament, $event.value)"
                  style="width: 200px;" size="small" />
                </div>
                <div class="action-panel">
                  @if (fav.fragments.length > 0 && fav.selected) {
                    <div class="action-row">
                      <div (click)="routeToAllocationEdit(fav.tournament, fav.selected.data)" class="action-item">
                        <i class="pi pi-pencil action" aria-label="Duplicate allocation" title="Duplicate allocation"></i>
                      </div>
                      @if (fav.tournament.current) {
                        <div (click)="toggleFragmentAllocationVisibilty(fav.selected.data, fav.tournament, dayAllocation.day.id, partRow.partDay.id)" class="action-item">
                          @if(fav.selected.data.visible) {
                            <i class="pi pi-eye action" aria-label="Unpublish the allocation " ></i>
                          } @else {
                            <i class="pi pi-eye-slash action" aria-label="Publish the allocation" ></i>
                          }
                        </div>
                      }
                    </div>
                  }
                  <div class="action-row">
                    <div (click)="createFragmentAllocation(fav.tournament, dayAllocation.day.id, partRow.partDay.id)" class="action-item">
                      <i class="pi pi-plus action action-plus" aria-label="Create a new full day allocation" title="Create a new full day allocation"></i>
                    </div>
                    @if (fav.fragments.length > 0 && fav.selected) {
                      <div (click)="duplicateFragmentAllocation(fav.selected.data, fav.tournament, dayAllocation.day.id, partRow.partDay.id)" class="action-item">
                        <i class="pi pi-copy action" aria-label="Duplicate allocation" title="Duplicate allocation"></i>
                      </div>
                      <div (click)="deleteFragmentAllocation(fav.selected.data, fav.tournament, dayAllocation.day.id, partRow.partDay.id)" class="action-item">
                        <i class="pi pi-trash action" aria-label="Remove full day allocation" title="Remove full day allocation"></i>
                      </div>
                    }
                  </div>
                </div>
              </td>
            }
          </tr>
        }
      }
    }
  </table>
}
  `,
  styles: [`
    .noBorder { border: none !important;}
    .dayAllocationTable {border-collapse: collapse; margin: 0 auto; }
    .dayAllocationTable th, .dayAllocationTable td {  border: 1px solid lightgray; }
    .dayAllocationTable .title-row { }
    .dayAllocationTable td, .dayAllocationTable th { padding: 10px; vertical-align: middle;  }

    .current-allocation { background-color: #CEDFEB; }
    :host { --border-selection: 2px solid black; }
    th.current-allocation{ border-top:   var(--border-selection) !important; }
    th.current-allocation, td.current-allocation{
      border-left:  var(--border-selection) !important;
      border-right: var(--border-selection) !important;
    }
    td.current-allocation.last-row{ border-bottom: var(--border-selection) !important; }

    a { cursor: pointer; text-decoration: underline; color: blue; margin-right: 10px;}
    i { cursor: pointer;}
    .action-panel { text-align: right;}
    .action-row {margin-top: 10px; vertical-align: top; display: inline-block;}
    .action-item { font-weight: normal !important; }
    .action-row .action-item { display: inline-block; }
    .action { font-size: 1.1rem; margin-right: 10px;}
    .action.pi-trash {  color: red;}
    .action.pi-plus {  color: green;}
    .action.pi-copy {  color: blue;}
    .action.pi-eye, .action.pi-eye-slash { color: orange;}
  `],
  standalone: true
})
export class TournamentRefereesAllocationsComponent extends AbstractTournamentPage  {

  private tournamentRefereeAllocationService = inject(TournamentRefereeAllocationService);
  private fragmentRefereeAllocationService = inject(FragmentRefereeAllocationService);
  private refereeAllocationService = inject(RefereeAllocationService);
  private dateService = inject(DateService);
  private refereeService = inject(RefereeService);
  dayAllocations = signal<DayAllocation[]>([]);
  tournamentAllocations = signal<TournamentRefereeAllocationView[]>([]);
  modalCreateAllocation = {
    show: false,
    newAllocationName: '',
    tourAlloc: undefined as (TournamentRefereeAllocation|undefined),
    dayId: '' as string,
    partDayId: undefined as (string|undefined)
  };

  constructor() {
    super();
    effect(() => {
      if (this.tournament()) {
        this.loadAllocations();
      }
    })
  }
  duplicateTournamentAllocation(tourAlloc: TournamentRefereeAllocation) {
    this.refereeAllocationService.duplicateTournamentAllocation(tourAlloc).subscribe((ta) => this.loadAllocations());
  }
  deleteTournamentAllocation(tourAlloc: TournamentRefereeAllocation) {
    this.refereeAllocationService.deleteTournamentAllocation(tourAlloc).then(() => this.loadAllocations());
  }
  createTournamentAllocation() {
    this.tournamentRefereeAllocationService.save({
      id: '',
      name: '',
      tournamentId: this.tournament()!.id,
      lastChange: new Date().getTime(),
      current: false,
      fragmentRefereeAllocations: []
    }).subscribe((tourAlloc: TournamentRefereeAllocation) => {
      this.tournamentAllocations.update(ts => [...this.tournamentAllocations(), {
        data: tourAlloc,
        refereeCoachesAllocator: [],
        refereesAllocator: []
      }]);
      this.dayAllocations.update(das => {
        das.forEach(da => {
          da.fullColumns.push({
            tournament: tourAlloc,
            fragments: da.fullColumns.length > 0 ? [...da.fullColumns[0].fragments] : [],
            selected: undefined
          });
          da.partRows.forEach(pr => {
            pr.columns.push({
              tournament: tourAlloc,
              fragments: pr.columns.length > 0 ? [...pr.columns[0].fragments] : [],
              selected: undefined
            })
          })
        })
        return [...das];
      })
    });
  }
  createFragmentAllocation(tourAlloc: TournamentRefereeAllocation, dayId: string, partDayId: string|undefined = undefined) {
    this.modalCreateAllocation.tourAlloc = tourAlloc;
    this.modalCreateAllocation.dayId = dayId;
    this.modalCreateAllocation.partDayId = partDayId;
    this.modalCreateAllocation.newAllocationName = 'D'+dayId
      + (partDayId ? '-'+partDayId : '')
      + '-' + Math.floor(Math.random()*100);
    this.modalCreateAllocation.show = true;
  }
  confirmAllocationCreation() {
    this.modalCreateAllocation.show = false;
    const tourAlloc: TournamentRefereeAllocation = this.modalCreateAllocation.tourAlloc!;
    const dayId: string = this.modalCreateAllocation.dayId!;
    const partDayId: string|undefined = this.modalCreateAllocation.partDayId;
    const name = this.modalCreateAllocation.newAllocationName;

    const tourAllocIdx = this.tournamentAllocations().findIndex(trav => trav.data.id === tourAlloc.id);
    if (tourAllocIdx < 0) return;
    const dayAlloc = this.dayAllocations().find((dayAllocation: DayAllocation) => dayAllocation.day.id === dayId);
    if (!dayAlloc) return;
    // create the FragmentRefereeAllocation
    const fragAlloc: FragmentRefereeAllocation = {
      id: '',
      name,
      tournamentId: this.tournament()!.id,
      lastChange: new Date().getTime(),
      dayId: dayId,
      refereeAllocatorAttendeeIds: [],
      refereeCoachAllocatorAttendeeIds: [],
      visible: false,
    };
    // create the FragmentRefereeAllocationView
    const pr:PartAllocationRow|undefined = partDayId ? dayAlloc.partRows.find(pr => pr.partDay.id === partDayId) : undefined;
    const fragAllocView: FragmentRefereeAllocationView = {
      data: fragAlloc,
      refereeCoachesAllocator:[],
      refereesAllocator: [],
      day: dayAlloc.day
    }
    if (partDayId && pr) {
      fragAllocView.partDay = pr.partDay;
      fragAlloc.partDayId = partDayId;
    }

    // Save the persistent object
    this.fragmentRefereeAllocationService.save(fragAlloc).subscribe((allocation) => {
      //Store the new allocation (with id) into View objects
      fragAllocView.data = allocation;

      // update the view objects
      // add the fragment in each column (full or part)
      const cols: AllocationCol[] = partDayId && pr ? pr.columns : dayAlloc.fullColumns;
      cols.forEach(col => col.fragments.push(fragAllocView));

      {
        // Unselect previous
        if (cols[tourAllocIdx].selected) {
          tourAlloc.fragmentRefereeAllocations = tourAlloc.fragmentRefereeAllocations
            .filter(fra => fra.id !== cols[tourAllocIdx].selected!.data.id);
        }
        // Set the new fragement as selected
        tourAlloc.fragmentRefereeAllocations.push({
          id: allocation.id,
          dayId: allocation.dayId,
          partDayId: allocation.partDayId
        });
        cols[tourAllocIdx].selected = fragAllocView;
        // save the tournament alloc because the selection changed.
        this.tournamentRefereeAllocationService.save(tourAlloc).subscribe();
      }
      this.dayAllocations.set([...this.dayAllocations()]);

      // this.routeToAllocationEdit(tourAlloc, allocation);
    });
  }
  deleteFragmentAllocation(fragmentAllocation: FragmentRefereeAllocation, tourAlloc: TournamentRefereeAllocation, dayId: string, partDayId: string|undefined = undefined) {
    this.tournamentAllocations.update(tournamentAllocations => {
      this.refereeAllocationService.deleteFragmentAllocation(fragmentAllocation, tournamentAllocations.map(tav => tav.data))
        .subscribe(() => this.loadAllocations());
      return tournamentAllocations;
    });
  }
  duplicateFragmentAllocation(fragmentAllocation: FragmentRefereeAllocation, tourAlloc: TournamentRefereeAllocation, dayId: string, partDayId: string|undefined = undefined) {
    const newAllocation: FragmentRefereeAllocation = {...fragmentAllocation};
    newAllocation.id = '';
    newAllocation.visible = false;
    newAllocation.name = fragmentAllocation.name + ' (copy)';
    this.fragmentRefereeAllocationService.save(newAllocation).subscribe(
      (allocation) => this.routeToAllocationEdit(tourAlloc, allocation));
  }
  onTourAllocChanged(tourAlloc: TournamentRefereeAllocation) {
    this.tournamentRefereeAllocationService.save(tourAlloc).subscribe();
  }
  toggleAllocationActivation(tourAlloc: TournamentRefereeAllocation) {
    tourAlloc.current = !tourAlloc.current;
    this.onTourAllocChanged(tourAlloc);
    if (tourAlloc.current) {
      // deactivate all other allocations of the same day
      this.tournamentAllocations.update(tas => {
        tas.forEach(ta => {
          if (ta.data.id !== tourAlloc.id) {
            ta.data.current = false;
            this.tournamentRefereeAllocationService.save(ta.data).subscribe();
          }
        })
        return tas.map(ta => ta);
      });
    }
  }
  toggleFragmentAllocationVisibilty(fragmentAllocation: FragmentRefereeAllocation, tourAlloc: TournamentRefereeAllocation, dayId: string, partDayId: string|undefined = undefined) {
    if (tourAlloc.current) {
      // only active allocations can be visible
      fragmentAllocation.visible = !fragmentAllocation.visible;
      this.fragmentRefereeAllocationService.save(fragmentAllocation).subscribe();
    }
  }
  routeToAllocationEdit(tournamentAllocation: TournamentRefereeAllocation, fragmentAllocation: FragmentRefereeAllocation) {
    this.router.navigate(['tournament', this.tournament()!.id, 'allocation', tournamentAllocation.id, 'fragment',fragmentAllocation.id ]);
  }
  selectFragmentAllocation(tourAlloc: TournamentRefereeAllocation, fav: FragmentRefereeAllocationView) {
    console.log('selectFragmentAllocation: ', tourAlloc, fav);
    const taIdx = this.tournamentAllocations().findIndex(ta => ta.data.id === tourAlloc.id);
    const da = this.dayAllocations().find(da => fav.day.id === da.day.id)!;
    const pr = fav.data.partDayId === undefined ? undefined : da.partRows.find(pr => pr.partDay.id === fav.data.partDayId);
    const cols = (fav.data.partDayId === undefined ? da.fullColumns : pr?.columns)!;

    // Unselect previous
    if (cols[taIdx].selected) {
      tourAlloc.fragmentRefereeAllocations = tourAlloc.fragmentRefereeAllocations
        .filter(fra => fra.id !== cols[taIdx].selected!.data.id);
    }

    // Set the new fragement as selected
    const fragDesc: FragmentRefereeAllocationDesc = {
      id: fav.data.id,
      dayId: fav.data.dayId
    };
    if (fav.data.partDayId) fragDesc.partDayId = fav.data.partDayId;
    tourAlloc.fragmentRefereeAllocations.push(fragDesc);
    cols[taIdx].selected = cols[taIdx].fragments.find(f => f.data.id === fav.data.id)!;

    // save the tournament alloc because the selection changed.
    this.tournamentRefereeAllocationService.save(tourAlloc).subscribe();
  }
  private loadAllocations() {
    const coaches: Map<string, RefereeCoach> = new Map<string, RefereeCoach>();
    let tournamentRefereeAllocationViews: TournamentRefereeAllocationView[] = [];
    let dayAllocations: DayAllocation[] = [];
    const tournamentId = this.tournament()!.id;
    this.refereeService.findRefereeCoaches(tournamentId).pipe(
      // Step 1: load tournament coaches
      map((cs: RefereeCoach[]) => cs.forEach(c => coaches.set(c.attendee.id, c))),

      // Step 2: load TournamentRefereeAllocation instances of the tournament
      mergeMap(() => this.tournamentRefereeAllocationService.byTournament(tournamentId)),
      map((allocations: TournamentRefereeAllocation[]) => {
        tournamentRefereeAllocationViews = allocations.map(ta => {
          return { data: ta, refereeCoachesAllocator: [], refereesAllocator: [] };
        });
        tournamentRefereeAllocationViews.sort((trav1, trav2) => {
          if (trav1.data.current) return -1;
          if (trav2.data.current) return 1;
          return trav1.data.lastChange - trav2.data.lastChange;
        })
      }),

      // Step 3: Create DayAllocation
      map(() => {
        dayAllocations = this.tournament()!.days.map(day => {
          const da:DayAllocation = {
            day,
            fullColumns: tournamentRefereeAllocationViews.map(tav => {
              return { tournament: tav.data,  fragments: [], selected: undefined };
            }),
            dateStr: this.dateService.toDate(day.date),
            showParts: day.parts.length > 1,
            partRows: day.parts.map((partDay) => {
              const partRow: PartAllocationRow  = {
                partDay,
                columns: tournamentRefereeAllocationViews.map((trav) => {
                  const ac: AllocationCol = { tournament: trav.data, fragments: [], selected: undefined}
                  return ac;
                })
              };
              return partRow;
            })
          }
          return da;
        })
      }),

      // Step 4: Load fragment Alloc
      mergeMap(() => this.fragmentRefereeAllocationService.byTournament(tournamentId)),
      map((frags) => {
        frags.forEach((fragAlloc: FragmentRefereeAllocation) => {
          const dayAllocation = dayAllocations.find(da => da.day.id === fragAlloc.dayId)
          if (dayAllocation) {
            const partDayIdx: number = fragAlloc.partDayId === undefined
              ? -1
              : dayAllocation.day.parts.findIndex(p => p.id === fragAlloc.partDayId);
            const partDay: PartDay|undefined = partDayIdx < 0
              ? undefined
              : dayAllocation.day.parts[partDayIdx];
            const fragView: FragmentRefereeAllocationView = {
              data: fragAlloc, refereesAllocator:[], refereeCoachesAllocator:[],
              day: dayAllocation.day,
              partDay: partDay
              };
            const cols: AllocationCol[] = partDay
              ? dayAllocation.partRows[partDayIdx].columns
              : dayAllocation.fullColumns;
            cols.forEach((col: AllocationCol, idx:number) => {
              col.fragments.push(fragView);
              if (tournamentRefereeAllocationViews[idx].data.fragmentRefereeAllocations
                .filter(fra => fra.id === fragAlloc.id).length > 0) {
                col.selected = fragView;
              }
            });
          }
        });
      }),
      map(() => {
        this.dayAllocations.set(dayAllocations);
        this.tournamentAllocations.set(tournamentRefereeAllocationViews);
      })
    ).subscribe();
  }
}
interface TournamentRefereeAllocationView {
  data: TournamentRefereeAllocation;
  refereesAllocator: RefereeCoach[];
  refereeCoachesAllocator: RefereeCoach[];
}
interface DayAllocation {
  day: Day;
  dateStr: string
  fullColumns: AllocationCol[]; // One per TournamentRefereeeAllocation
  showParts: boolean;
  partRows: PartAllocationRow[]; // One per part
}
interface AllocationCol {
  tournament: TournamentRefereeAllocation;
  fragments: FragmentRefereeAllocationView[];
  selected: FragmentRefereeAllocationView|undefined;
}
interface PartAllocationRow {
  partDay: PartDay;
  columns: AllocationCol[];// One per TournamentRefereeeAllocation
}
interface FragmentRefereeAllocationView {
  data: FragmentRefereeAllocation;
  day: Day;
  partDay?: PartDay;
  refereesAllocator: RefereeCoach[];
  refereeCoachesAllocator: RefereeCoach[];
}
interface LoadedData {
  tournamentRefereeAllocationViews: TournamentRefereeAllocationView[];
  dayAllocations: DayAllocation[];
}
