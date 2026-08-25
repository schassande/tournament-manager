import { Component, effect, inject, signal } from '@angular/core';
import { catchError, map, mergeMap, of, switchMap } from 'rxjs';

import { Day, PartDay, TournamentRefereeAllocation, FragmentRefereeAllocation, RefereeCoach, FragmentRefereeAllocationDesc, GeneralAllocationConfiguration } from '@tournament-manager/persistent-data-model';
import { AbstractTournamentPage } from '../component/tournament-abstract.page';
import { DateService } from '../service/date.service';
import { TournamentRefereeAllocationService } from '../service/tournament-referee-allocation.service';
import { FragmentRefereeAllocationService } from '../service/fragment-referee-allocation.service';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { RefereeAllocationService } from '../service/referee-allocation.service';
import { RefereeService } from '../service/referee.service';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';

@Component({
  selector: 'app-tournament-referees-allocation',
  imports: [ ButtonModule, CardModule, ConfirmDialogModule, DialogModule, FormsModule, InputTextModule, SelectModule],
  template: `
<p-dialog header="Allocation configuration" [modal]="true" [(visible)]="modalAllocationConfig.show" [style]="{ width: '34rem' }" (onHide)="resetAllocationConfigModal()">
  @if (modalAllocationConfig.draft) {
    <div class="allocation-config-form">
      <label for="maxGameInRowForReferee">Max referee consecutive game time (minutes)</label>
      <input pInputText id="maxGameInRowForReferee" type="number" min="20" max="60" step="1" [(ngModel)]="modalAllocationConfig.draft.maxGameInRowForReferee" />
      <label for="maxGameInRowForRefereeCoach">Max referee coach consecutive game time (minutes)</label>
      <input pInputText id="maxGameInRowForRefereeCoach" type="number" min="20" max="200" step="1" [(ngModel)]="modalAllocationConfig.draft.maxGameInRowForRefereeCoach" />
      <label for="maxRefereeGameTimePerDay">Max referee game time per day (minutes)</label>
      <input pInputText id="maxRefereeGameTimePerDay" type="number" min="20" max="200" step="1" [(ngModel)]="modalAllocationConfig.draft.maxRefereeGameTimePerDay" />
      <label for="nbRefereePerGame">Referees per game</label>
      <input pInputText id="nbRefereePerGame" type="number" min="1" step="1" [(ngModel)]="modalAllocationConfig.draft.nbRefereePerGame" />
      <label class="config-checkbox" for="allocateRefereeCoach"><input id="allocateRefereeCoach" type="checkbox" [(ngModel)]="modalAllocationConfig.draft.allocateRefereeCoach" /> Allocate referee coaches</label>
      <label class="config-checkbox" for="refereeCoachTwoField"><input id="refereeCoachTwoField" type="checkbox" [(ngModel)]="modalAllocationConfig.draft.refereeCoachTwoField" /> Allow referee coaches on two fields</label>
      @if (modalAllocationConfig.error) { <div class="config-error" role="alert">{{modalAllocationConfig.error}}</div> }
      <div class="config-actions">
        <p-button label="Delete" severity="danger" (click)="deleteAllocationConfig()" />
        <span class="config-actions-spacer"></span>
        <p-button label="Cancel" severity="secondary" (click)="modalAllocationConfig.show = false" />
        <p-button label="Save" [disabled]="!isAllocationConfigValid()" (click)="saveAllocationConfig()" />
      </div>
    </div>
  }
</p-dialog>

@if (simpleMode()) {
  <div class="mode-switch-container">
    <p-button label="Switch to advanced version" [text]="true" styleClass="mode-switch-button" (click)="setSimpleMode(false)" />
  </div>
  @if (simpleModeError()) {
    <div class="simple-mode-error" role="alert">{{simpleModeError()}}</div>
  }
  <div class="simple-mode-days">
    @for (dayAllocation of dayAllocations(); track dayAllocation.day.id) {
      <div class="simple-mode-day"
        [class.simple-mode-day-clickable]="dayAllocation.day.parts.length <= 1"
        (click)="dayAllocation.day.parts.length <= 1 && editSimpleDay(dayAllocation)">
        <div class="simple-mode-day-title">Day {{dayAllocation.day.id}}</div>
        <div>{{dayAllocation.dateStr}}</div>
        <div>{{dateService.toDayOfWeek(dayAllocation.day.date)}}</div>
        @if (dayAllocation.day.parts.length > 1) {
          <div class="simple-mode-part-buttons">
            @for (partDay of dayAllocation.day.parts; track partDay.id) {
              <div class="simple-mode-part-action">
                <p-button label="Edit {{partDay.name || partDay.id}}" styleClass="simple-edit-button" (click)="editSimpleAllocation(dayAllocation.day.id, partDay.id)" />
                @if (simpleFragment(dayAllocation.day.id, partDay.id); as fragment) {
                  <button type="button" class="fragment-visibility-button"
                    [attr.aria-label]="fragment.visible ? 'Public allocation' : 'Private allocation'"
                    [title]="fragment.visible ? 'Public allocation' : 'Private allocation'"
                    (click)="$event.stopPropagation(); toggleSimpleFragmentVisibility(fragment)">
                    <i class="pi" [class.pi-eye]="fragment.visible" [class.pi-eye-slash]="!fragment.visible"></i>
                  </button>
                }
              </div>
            }
          </div>
        } @else {
          @if (simpleFragment(dayAllocation.day.id); as fragment) {
            <button type="button" class="fragment-visibility-button simple-mode-day-visibility"
              [attr.aria-label]="fragment.visible ? 'Public allocation' : 'Private allocation'"
              [title]="fragment.visible ? 'Public allocation' : 'Private allocation'"
              (click)="$event.stopPropagation(); toggleSimpleFragmentVisibility(fragment)">
              <i class="pi" [class.pi-eye]="fragment.visible" [class.pi-eye-slash]="!fragment.visible"></i>
            </button>
          }
        }
      </div>
    }
  </div>
  <div class="simple-mode-config">
    <p-button label="Configure" icon="pi pi-cog" [text]="true" styleClass="simple-config-button" (click)="configureSimpleTournamentAllocation()" />
  </div>
} @else {
  <div class="mode-switch-container">
    <p-button label="Simple version" [text]="true" styleClass="mode-switch-button" (click)="setSimpleMode(true)" />
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
            @if (tournamentAllocations()!.length > 1) {
              <div style="height: 30px; text-align: center">
                @if (tAlloc.data.current) {
                Selected
                } @else {
                  <div (click)="toggleAllocationActivation(tAlloc.data)" class="action-item">
                    <i class="pi pi-play action" aria-label="Set as current allocation" title="Set as current allocation"></i>
                    <span>Select</span>
                  </div>
                }
              </div>
              <div>
                <input type="text" pInputText [(ngModel)]="tAlloc.data.name" required
                  (ngModelChange)="onTourAllocChanged(tAlloc.data)" pSize="small" style="width: 200px;" />
              </div>
            }
            <div class="action-panel">
              <div class="action-row">
                <div (click)="configureTournamentAllocation(tAlloc.data)" class="action-item">
                  <i class="pi pi-cog action" aria-label="Configure allocation" title="Configure allocation"></i>
                </div>
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
            <div>{{dateService.toDayOfWeek(dayAllocation.day.date)}}</div>
            <div>{{dayAllocation.dateStr}}</div>
          </td>
          <td>Full</td>
          @for(fav of dayAllocation.fullColumns; track fav.tournament.id) {
            <td class="colAllocation {{fav.tournament.current ? 'current-allocation' : ''}} {{!dayAllocation.showParts && lastDay ?'last-row':''}}">
              @if (fav.fragments.length > 0) {
                <div>
                  <p-select [options]="fav.fragments" [(ngModel)]="fav.selected" optionLabel="data.name" placeholder="Select an allocation"
                    (onChange)="selectFragmentAllocation(fav.tournament, $event.value)"
                    style="width: 200px;" size="small" />
                </div>
              }
              <div class="action-panel">
                <div class="action-row">
                  @if (fav.fragments.length > 0 && fav.selected) {
                    <div (click)="routeToAllocationEdit(fav.tournament, fav.selected.data)" class="action-item">
                      <i class="pi pi-pencil action" aria-label="Edit allocation" title="Edit allocation"></i>
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
                  }
                  <div (click)="createFragmentAllocation(fav.tournament, dayAllocation.day.id)" class="action-item">
                    <i class="pi pi-plus action action-plus" aria-label="Create a new full day allocation" title="Create a new full day allocation"></i>
                  </div>
                  @if (fav.fragments.length > 0 && fav.selected) {
                    <div (click)="configureFragmentAllocation(fav.selected.data)" class="action-item">
                      <i class="pi pi-cog action" aria-label="Configure allocation" title="Configure allocation"></i>
                    </div>
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
    .allocation-config-form { display: grid; gap: 8px; }
    .allocation-config-form input[type='number'] { width: 100%; }
    .config-checkbox { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
    .config-error { color: #b91c1c; margin-top: 8px; }
    .config-actions { display: flex; align-items: center; gap: 8px; margin-top: 16px; }
    .config-actions-spacer { flex: 1; }
    .mode-switch-container { display: flex; justify-content: flex-end; margin: 0 20px 20px 0; }
    .mode-switch-button { color: blue; text-decoration: underline; }
    .simple-mode-days { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
    .simple-mode-day { min-width: 180px; padding: 15px; text-align: center; border: 1px solid lightgray; }
    .simple-mode-day-clickable { cursor: pointer; }
    .simple-mode-day-clickable:hover { background-color: #f5f5f5; }
    .simple-mode-day-title { font-weight: bold; }
    .simple-mode-part-buttons { display: flex; flex-direction: column; align-items: center; gap: 20px; margin-top: 20px; }
    .simple-mode-part-action { display: flex; align-items: center; gap: 8px; }
    .simple-edit-button { display: block; }
    .fragment-visibility-button { display: inline-flex; align-items: center; justify-content: center; padding: 4px; border: 0; background: transparent; color: inherit; cursor: pointer; }
    .fragment-visibility-button:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
    .simple-mode-day-visibility { margin-top: 20px; }
    .simple-mode-config { display: flex; justify-content: center; margin-top: 20px; }
    .simple-config-button { color: blue; text-decoration: underline; }
    .simple-mode-error { max-width: 500px; margin: 20px auto; color: #b91c1c; text-align: center; }
  `],
  standalone: true
})
export class TournamentRefereesAllocationsComponent extends AbstractTournamentPage  {

  private static readonly MODE_STORAGE_KEY = 'tournament-referees-allocations-mode';

  private tournamentRefereeAllocationService = inject(TournamentRefereeAllocationService);
  private fragmentRefereeAllocationService = inject(FragmentRefereeAllocationService);
  private refereeAllocationService = inject(RefereeAllocationService);
  dateService = inject(DateService);
  private refereeService = inject(RefereeService);
  dayAllocations = signal<DayAllocation[]>([]);
  tournamentAllocations = signal<TournamentRefereeAllocationView[]>([]);
  simpleMode = signal(this.readSimpleMode());
  simpleModeError = signal('');
  modalCreateAllocation = {
    show: false,
    newAllocationName: '',
    tourAlloc: undefined as (TournamentRefereeAllocation|undefined),
    dayId: '' as string,
    partDayId: undefined as (string|undefined)
  };
  modalAllocationConfig: AllocationConfigModal = {
    show: false,
    scope: 'tournament',
    tournamentAllocation: undefined,
    fragmentAllocation: undefined,
    draft: undefined,
    error: ''
  };

  constructor() {
    super();
    effect(() => {
      if (this.tournament()) {
        this.loadAllocations();
      }
    })
  }

  /** Reads the persisted page mode, defaulting to simple mode. */
  private readSimpleMode(): boolean {
    if (typeof localStorage === 'undefined') return true;
    return localStorage.getItem(TournamentRefereesAllocationsComponent.MODE_STORAGE_KEY) !== 'advanced';
  }

  /** Changes the page mode and persists the user's preference locally. */
  setSimpleMode(simple: boolean): void {
    this.simpleMode.set(simple);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TournamentRefereesAllocationsComponent.MODE_STORAGE_KEY, simple ? 'simple' : 'advanced');
    }
    this.simpleModeError.set('');
    if (simple && this.tournamentAllocations().length === 0) this.loadAllocations();
  }

  /** Opens tournament-level configuration from the simple-mode action. */
  configureSimpleTournamentAllocation(): void {
    const allocation = this.simpleTournamentAllocation();
    if (allocation) {
      this.configureTournamentAllocation(allocation);
    } else {
      this.simpleModeError.set('No current tournament allocation is available.');
    }
  }

  /** Opens the only part-day allocation represented by a simple-mode day card. */
  editSimpleDay(dayAllocation: DayAllocation): void {
    if (dayAllocation.showParts) {
      this.editSimpleAllocation(dayAllocation.day.id, dayAllocation.day.parts[0]?.id);
    } else {
      this.editSimpleAllocation(dayAllocation.day.id);
    }
  }

  /** Opens the selected fragment allocation for a day, creating it when absent. */
  editSimpleAllocation(dayId: string, partDayId: string|undefined = undefined): void {
    const tournamentAllocation = this.simpleTournamentAllocation();
    if (!tournamentAllocation) {
      this.simpleModeError.set('No current tournament allocation is available.');
      return;
    }
    console.log('editSimpleAllocation', dayId, partDayId);
    const descriptor = tournamentAllocation.fragmentRefereeAllocations
      .find(fragment => this.isSameFragment(dayId, partDayId, fragment));
    const fragment = descriptor ? this.findFragmentAllocation(descriptor.id) : undefined;
    if (fragment) {
      this.routeToAllocationEdit(tournamentAllocation, fragment);
    } else {
      if (descriptor) {
        this.simpleModeError.set('The selected allocation could not be found. Please refresh and try again.');
      } else {
        this.createSimpleFragmentAllocation(tournamentAllocation, dayId, partDayId);
      }
    }
  }
  isSameFragment(dayId: string, partDayId: string|undefined, fragment: FragmentRefereeAllocationDesc): boolean {
    if (fragment.dayId !== dayId) return false;
    if (partDayId) {
      return fragment.partDayId === partDayId;
    } else {
      return ! fragment.partDayId;
    }
  }
  /** Returns the active tournament allocation, or the only available allocation. */
  private simpleTournamentAllocation(): TournamentRefereeAllocation|undefined {
    const allocations = this.tournamentAllocations();
    return allocations.find(view => view.data.current)?.data
      ?? (allocations.length === 1 ? allocations[0].data : undefined);
  }

  /** Finds a loaded fragment allocation by its persistent identifier. */
  private findFragmentAllocation(id: string): FragmentRefereeAllocation|undefined {
    return this.dayAllocations().flatMap(day => [
      ...day.fullColumns.flatMap(column => column.fragments),
      ...day.partRows.flatMap(row => row.columns.flatMap(column => column.fragments))
    ]).find(fragment => fragment.data.id === id)?.data;
  }

  /** Returns the current simple-mode fragment for a day or one of its parts. */
  simpleFragment(dayId: string, partDayId?: string): FragmentRefereeAllocation|undefined {
    const allocation = this.simpleTournamentAllocation();
    const descriptor = allocation?.fragmentRefereeAllocations
      .find(fragment => this.isSameFragment(dayId, partDayId, fragment));
    return descriptor ? this.findFragmentAllocation(descriptor.id) : undefined;
  }

  /** Toggles and persists the publication state of a simple-mode fragment. */
  toggleSimpleFragmentVisibility(fragment: FragmentRefereeAllocation): void {
    fragment.visible = !fragment.visible;
    this.fragmentRefereeAllocationService.save(fragment).subscribe({
      error: () => {
        fragment.visible = !fragment.visible;
        this.simpleModeError.set('Unable to save the fragment visibility.');
      }
    });
  }

  /** Creates and persists a missing simple-mode fragment before navigation. */
  private createSimpleFragmentAllocation(
    tournamentAllocation: TournamentRefereeAllocation,
    dayId: string,
    partDayId?: string
  ): void {
    const allocation: FragmentRefereeAllocation = {
      id: '',
      name: this.fragmentAllocationName(dayId, partDayId),
      tournamentId: this.tournament()!.id,
      lastChange: Date.now(),
      dayId,
      refereeAllocatorAttendeeIds: [],
      refereeCoachAllocatorAttendeeIds: [],
      visible: false
    };
    if (partDayId) allocation.partDayId = partDayId;
    
    this.fragmentRefereeAllocationService.save(allocation).pipe(
      mergeMap(saved => {
        const descriptor: FragmentRefereeAllocationDesc = { id: saved.id, dayId };
        if (partDayId) descriptor.partDayId = partDayId;
        const updated = {
          ...tournamentAllocation,
          fragmentRefereeAllocations: [
            ...tournamentAllocation.fragmentRefereeAllocations.filter(fragment =>
              !(fragment.dayId === dayId && fragment.partDayId === partDayId)),
            descriptor
          ]
        };
        return this.tournamentRefereeAllocationService.save(updated).pipe(map(() => saved));
      })
    ).subscribe({
      next: saved => {
        this.simpleModeError.set('');
        this.loadAllocations();
        this.routeToAllocationEdit(tournamentAllocation, saved);
      },
      error: () => this.simpleModeError.set('Unable to create the allocation. Please try again.')
    });
  }

  /** Generates the existing fragment allocation name format. */
  private fragmentAllocationName(dayId: string, partDayId?: string): string {
    return 'D' + dayId + (partDayId ? '-' + partDayId : '') + '-' + Math.floor(Math.random() * 100);
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
  /** Opens the configuration editor for a tournament allocation. */
  configureTournamentAllocation(allocation: TournamentRefereeAllocation) {
    this.openAllocationConfig('tournament', allocation);
  }

  /** Opens the configuration editor for the selected fragment allocation. */
  configureFragmentAllocation(allocation: FragmentRefereeAllocation) {
    this.openAllocationConfig('fragment', allocation);
  }

  /** Opens the configuration editor, initializing missing values with defaults. */
  private openAllocationConfig(scope: AllocationConfigScope, allocation: TournamentRefereeAllocation|FragmentRefereeAllocation) {
    this.modalAllocationConfig = {
      show: true,
      scope,
      tournamentAllocation: scope === 'tournament' ? allocation as TournamentRefereeAllocation : undefined,
      fragmentAllocation: scope === 'fragment' ? allocation as FragmentRefereeAllocation : undefined,
      draft: this.toAllocationConfigForm(allocation.generalConfig),
      error: ''
    };
  }

  /** Saves the configuration at the scope selected when the modal was opened. */
  saveAllocationConfig() {
    const draft = this.modalAllocationConfig.draft;
    if (!draft || !this.isAllocationConfigValid()) return;
    const config = this.toAllocationConfig(draft);
    const target = this.modalAllocationConfig.scope === 'tournament'
      ? this.modalAllocationConfig.tournamentAllocation
      : this.modalAllocationConfig.fragmentAllocation;
    if (!target) return;

    if (this.modalAllocationConfig.scope === 'tournament') {
      const tournamentAllocation = target as TournamentRefereeAllocation;
      this.tournamentRefereeAllocationService.save({ ...tournamentAllocation, generalConfig: config }).subscribe({
        next: (saved: TournamentRefereeAllocation) => {
          tournamentAllocation.generalConfig = saved.generalConfig;
          this.modalAllocationConfig.show = false;
          this.loadAllocations();
        },
        error: () => this.modalAllocationConfig.error = 'Unable to save the allocation configuration.'
      });
    } else {
      const fragmentAllocation = target as FragmentRefereeAllocation;
      this.fragmentRefereeAllocationService.save({ ...fragmentAllocation, generalConfig: config }).subscribe({
        next: (saved: FragmentRefereeAllocation) => {
          fragmentAllocation.generalConfig = saved.generalConfig;
          this.modalAllocationConfig.show = false;
          this.loadAllocations();
        },
        error: () => this.modalAllocationConfig.error = 'Unable to save the allocation configuration.'
      });
    }
  }

  /** Deletes the optional configuration object without confirmation. */
  deleteAllocationConfig() {
    const target = this.modalAllocationConfig.scope === 'tournament'
      ? this.modalAllocationConfig.tournamentAllocation
      : this.modalAllocationConfig.fragmentAllocation;
    if (!target) return;
    const deleteConfig = target.generalConfig
      ? (this.modalAllocationConfig.scope === 'tournament'
        ? this.tournamentRefereeAllocationService.deleteGeneralConfig(target.id)
        : this.fragmentRefereeAllocationService.deleteGeneralConfig(target.id))
      : Promise.resolve();
    deleteConfig.then(() => {
      target.generalConfig = undefined;
      this.modalAllocationConfig.show = false;
      this.loadAllocations();
    }).catch(() => this.modalAllocationConfig.error = 'Unable to delete the allocation configuration.');
  }

  /** Returns whether the current draft satisfies all configuration constraints. */
  isAllocationConfigValid(): boolean {
    const draft = this.modalAllocationConfig.draft;
    return !!draft
      && this.isIntegerInRange(draft.maxGameInRowForReferee, 20, 60)
      && this.isIntegerInRange(draft.maxGameInRowForRefereeCoach, 20, 200)
      && this.isIntegerInRange(draft.maxRefereeGameTimePerDay, 20, 200)
      && this.isIntegerInRange(draft.nbRefereePerGame, 1, Number.MAX_SAFE_INTEGER)
      && typeof draft.allocateRefereeCoach === 'boolean'
      && typeof draft.refereeCoachTwoField === 'boolean';
  }

  /** Clears transient modal state after the configuration dialog closes. */
  resetAllocationConfigModal() {
    if (!this.modalAllocationConfig.show) {
      this.modalAllocationConfig.draft = undefined;
      this.modalAllocationConfig.error = '';
    }
  }

  private toAllocationConfigForm(config: GeneralAllocationConfiguration|undefined): AllocationConfigForm {
    return {
      maxGameInRowForReferee: config?.maxGameInRowForReferee ?? 50,
      maxGameInRowForRefereeCoach: config?.maxGameInRowForRefereeCoach ?? 160,
      allocateRefereeCoach: config?.allocateRefereeCoach ?? false,
      refereeCoachTwoField: config?.refereeCoachTwoField ?? false,
      nbRefereePerGame: config?.nbRefereePerGame ?? 3,
      maxRefereeGameTimePerDay: config?.maxRefereeGameTimePerDay ?? 140
    };
  }

  private toAllocationConfig(form: AllocationConfigForm): GeneralAllocationConfiguration {
    return {
      maxGameInRowForReferee: form.maxGameInRowForReferee!,
      maxGameInRowForRefereeCoach: form.maxGameInRowForRefereeCoach!,
      allocateRefereeCoach: form.allocateRefereeCoach,
      refereeCoachTwoField: form.refereeCoachTwoField,
      nbRefereePerGame: form.nbRefereePerGame!,
      maxRefereeGameTimePerDay: form.maxRefereeGameTimePerDay!
    };
  }

  private isIntegerInRange(value: number|null, min: number, max: number): value is number {
    return value !== null && Number.isInteger(value) && value >= min && value <= max;
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
      switchMap((allocations: TournamentRefereeAllocation[]) => {
        if (allocations.length > 0 || !this.simpleMode()) return of(allocations);
        const firstAllocation: TournamentRefereeAllocation = {
          id: '',
          name: this.tournamentAllocationName(),
          tournamentId,
          lastChange: Date.now(),
          current: true,
          fragmentRefereeAllocations: []
        };
        return this.tournamentRefereeAllocationService.save(firstAllocation).pipe(
          map(saved => [saved]),
          catchError(() => {
            this.simpleModeError.set('Unable to create the first allocation. Please try again.');
            return of([] as TournamentRefereeAllocation[]);
          })
        );
      }),
      map((allocations: TournamentRefereeAllocation[]) => {
        if (allocations.length > 0) this.simpleModeError.set('');
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

  /** Generates the name used for an automatically created first tournament allocation. */
  private tournamentAllocationName(): string {
    return 'Allocation-' + Math.floor(Math.random() * 100);
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

/** Scope edited by the allocation configuration modal. */
type AllocationConfigScope = 'tournament' | 'fragment';

/** Nullable draft values used to disable Save for incomplete numeric inputs. */
interface AllocationConfigForm {
  maxGameInRowForReferee: number|null;
  maxGameInRowForRefereeCoach: number|null;
  allocateRefereeCoach: boolean;
  refereeCoachTwoField: boolean;
  nbRefereePerGame: number|null;
  maxRefereeGameTimePerDay: number|null;
}

/** State owned by the allocation configuration modal. */
interface AllocationConfigModal {
  show: boolean;
  scope: AllocationConfigScope;
  tournamentAllocation: TournamentRefereeAllocation|undefined;
  fragmentAllocation: FragmentRefereeAllocation|undefined;
  draft: AllocationConfigForm|undefined;
  error: string;
}
interface LoadedData {
  tournamentRefereeAllocationViews: TournamentRefereeAllocationView[];
  dayAllocations: DayAllocation[];
}
