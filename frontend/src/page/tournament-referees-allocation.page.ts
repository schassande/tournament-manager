import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal, OnInit, AfterViewInit, OnChanges, SimpleChanges } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { finalize, forkJoin, map, mergeMap, Observable, of, take } from 'rxjs';

import { AbstractTournamentPage } from '../component/tournament-abstract.page';
import { Day, Division, Field, Game, GameAttendeeAllocation, PartDay, Referee, TournamentRefereeAllocation, FragmentRefereeAllocation, RefereeCoach, Team, Timeslot, FragmentRefereeAllocationDesc } from '@tournament-manager/persistent-data-model';
import { DayView, FieldView, GameAttendeeAllocationView, GameView, PartView, TimeSlotView } from '../allocation-data-model';

import { DateService } from '../service/date.service';
import { GameAttendeeAllocationService } from '../service/game-attendee-allocation.service';
import { GameService } from '../service/game.service';
import { RefereeService } from '../service/referee.service';
import { GameRefereeAllocatorComponent, SearchableReferee, SearchableCoach, toSearchableCoaches, toSearchableReferees } from '../component/game-referee-allocator.component';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { AllocationAction, ClipboardItem, SelectionDescriptor, SelectionService } from '../service/selection.service';
import { FragmentRefereeAllocationService } from '../service/fragment-referee-allocation.service';
import { TournamentRefereeAllocationService } from '../service/tournament-referee-allocation.service';
import { UserService } from '../service/user.service';

const KEY_SHOW_COACHES = 'tournament-referee-allocation.show-coaches';

@Component({
  selector: 'app-tournament-referees-allocation',
  imports: [CheckboxModule, CommonModule, ConfirmDialogModule, DatePipe, FormsModule, GameRefereeAllocatorComponent, InputTextModule, ProgressSpinnerModule, SelectModule, TooltipModule],
  template: `
  @if (loading()) {
    <div class="allocation-loading-overlay" role="dialog" aria-modal="true" aria-label="Loading allocation">
      <div class="allocation-loading-panel">
        <p-progress-spinner ariaLabel="Loading allocation" />
      </div>
    </div>
  }
  @if(day() && allocation()) {
    <div style="text-align: center;">
      <p-confirmdialog />
      @if (showAllocationName()) {
        <div style="margin-bottom: 10px;">
          <span><label>Name: </label><input type="text" pInputText [(ngModel)]="allocation()!.name" (change)="allocationNameChanged()" size="small"/></span>
        </div>
      }

      <div class="allocation-navigation-row">
        <p-select [options]="days()" [ngModel]="selectedDay()" (onChange)="onDaySelectionChange($event.value)"
          [style]="{ width: '190px', 'margin-right': '8px' }"
          ariaLabel="Select day" placeholder="Select day">
          <ng-template #item let-dayDesc>
            {{dayDesc.day.id}}: {{dayDesc.date | date: 'EEEE'}}
          </ng-template>
          <ng-template #selectedItem let-dayDesc>
            {{dayDesc.day.id}}: {{dayDesc.date | date: 'EEEE'}}
          </ng-template>
        </p-select>
        @if (day()!.parts.length > 1 && selectedDay()) {
          @if (selectedDay()!.fragmentAllocationDesc) {
            <a (click)="routeToFragmentAllocation(selectedDay()!.fragmentAllocationDesc!.id)" style="margin: 0 5px;">Full</a>
          }
          @for(p of selectedDay()!.partDescs; track p.id) {
            <a (click)="routeToFragmentAllocation(p.id)" style="margin: 0 5px;">Part {{p.partDayId}}</a>
          }
        }
        @if (showReferees()) {
          @for(hlrId of highlightedRefereeIds(); let idx=$index; track idx) {
            <p-select [options]="referees()" [ngModel]="highlightedRefereeIds()[idx]" (onChange)="onHhighlightedRefereeChange($event.value, idx)"
              optionValue="id"
              style="width: 246px; margin: 0 2px;"
              [filter]="true" filterBy="search" size="small"
              placeholder="Select referee to highlight"
              [showClear]="true"
              class="referee-highlight-{{idx}}">
              <ng-template #item let-referee>
                {{refereeToString(referee)}}
              </ng-template>
              <ng-template #selectedItem let-referee>
                {{refereeToString(referee)}}
              </ng-template>
            </p-select>
          }
        }
        <span class="show-coaches-option">
          <p-checkbox [(ngModel)]="showCoaches" (ngModelChange)="onShowCoachesChange($event)"
            inputId="show-referee-coach" [binary]="true"></p-checkbox>
          <label for="show-referee-coach">Referee coach</label>
        </span>
        <i class="pi pi-info-circle allocation-summary-info"
          [pTooltip]="allocationSummary()" tooltipPosition="top"
          tabindex="0" role="img" [attr.aria-label]="allocationSummary()"></i>
      </div>
      @for(part of day()!.partViews; track part.id) {
        @if (day()!.partViews.length > 1) {
        <h3>Part {{ part.id }}</h3>
        }
        <div class="allocation-table-container">
          <table class="allocation-table">
            <tr class="tableRowTitle">
              <th class="timeslotCell">Slot</th>
              @for(field of part.fields; track field.id) {
                <th class="fieldCol">{{ field.name }}</th>
              }
            </tr>
            @for(ts of part.timeSlotViews; track ts.id) {
              <tr class="tableRowItem">
                <td class="timeslotCell">{{ts.startStr}}</td>
                @if (ts.playingSlot) {
                  @for(field of ts.fields; track field.id) {
                    <td [ngClass]="{ 'noGameCell': !field.game,  'gameCell': field.game, 'selectable':selection() && !field.game && selection()?.cellType === 'EmptySlot' && selection()?.fieldId === field.id && selection()?.timeslotId === ts.id }" class="fieldCol {{gameCellStyle()}}" >
                      @if (field.game) {
                        <app-game-referee-allocator [game]="field.game" [coaches]="coaches()"
                          [showCoaches]="showCoaches()" [showReferees]="showReferees()" [showRefereeLevel]="showRefereeLevel()"
                          [showBadgeSystem]="showBadgeSystem()" [showDivisionColor]="showDivisionColor()"
                          [referees]="referees()" [allocation]="allocation()!"
                          [highlightedRefereeIds]="highlightedRefereeIds()">
                        </app-game-referee-allocator>
                      }
                    </td>
                  }
                } @else {
                  <td style="text-align: center;">{{ ts.durationStr }}</td>
                }
              </tr>
            }
          </table>
        </div>
      }
    </div>
  }
  `,
  styles: [`
    a { text-decoration: underline; color: blue;}
    h2, h3 { text-align: center; padding-top: 10px;}
    .fieldCol { width: 250px;}
    .noGameCell { background-color: #eeeeee; }
    .gameCell { background-color: #ffffff;  vertical-align: top;}
    .tableRowItem .timeslotCell { font-weight: bold; }
    .tableRowTitle th, .tableRowItem td {
      text-align: center;
      border: 2px grey solid;
    }
    .allocation-table-container {
      height: calc(100vh - 120px);
      overflow: auto;
      position: relative;
    }
    .allocation-table {
      border-collapse: separate;
      border-spacing: 0;
    }
    .tableRowTitle th {
      position: sticky;
      top: 0;
      z-index: 2;
      background-color: #f5f5f5;
    }
    .tableRowTitle th:first-child,
    .tableRowItem .timeslotCell {
      position: sticky;
      left: 0;
      z-index: 1;
      background-color: #ffffff;
    }
    .tableRowTitle th:first-child {
      z-index: 3;
    }
    .tableRowTitle th, .timeslotCell {
      padding: 10px 5px;
    }
    .allocation-navigation-row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      text-align: left;
    }
    .allocation-summary-info {
      margin-left: auto;
      margin-right: 10px;
      font-size: 1.21rem;
      color: blue;
      cursor: help;
      vertical-align: middle;
    }
    .show-coaches-option {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      margin-left: 10px;
      vertical-align: middle;
    }
    .show-coaches-option label {
      cursor: pointer;
    }
    .allocation-table {
      margin: 0;
    }
    .allocation-loading-overlay {
      position: fixed;
      inset: 0;
      z-index: 1100;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: rgba(0, 0, 0, 0.35);
    }
    .allocation-loading-panel {
      display: flex;
      justify-content: center;
      padding: 1.5rem;
      border-radius: 8px;
      background-color: white;
    }
    `],
  standalone: true
})
export class TournamentRefereesAllocationComponent extends AbstractTournamentPage {

  private refereeService = inject(RefereeService);
  private dateService = inject(DateService);
  private gameService = inject(GameService);
  private gameAttendeeAllocationService = inject(GameAttendeeAllocationService);
  private fragmentRefereeAllocationService = inject(FragmentRefereeAllocationService);
  private tournamentRefereeAllocationService = inject(TournamentRefereeAllocationService);
  private selectionService = inject(SelectionService);
  private confirmationService = inject(ConfirmationService);
  private userService = inject(UserService);
  private route: ActivatedRoute = inject(ActivatedRoute);

  day = signal<DayView|undefined>(undefined);
  days = signal<DayDesc[]>([]);
  selectedDay = computed(() => this.days().find(dayDesc => dayDesc.current));
  gameCount = computed(() => this.day()?.partViews.reduce(
    (count, part) => count + part.timeSlotViews.reduce(
      (partCount, timeslot) => partCount + timeslot.fields.filter(field => field.game).length, 0
    ), 0
  ) ?? 0);
  allocationSummary = computed(() =>
    `${this.gameCount()} games, ${this.referees().length} referees and ${this.coaches().length} referee coaches.`
  );
  showAllocationName = computed(() => {
    const allocation = this.allocation();
    const tournamentAllocation = this.tournamentAllocation();
    if (!allocation || !tournamentAllocation) return false;
    return tournamentAllocation.fragmentRefereeAllocations.filter(fragment =>
      fragment.dayId === allocation.dayId && fragment.partDayId === allocation.partDayId
    ).length > 1;
  });
  loading = signal<boolean>(true);
  private loadingStartedAt = 0;
  private readonly minimumLoadingDisplayMs = 100;

  allocation = signal<FragmentRefereeAllocation|undefined>(undefined);
  tournamentAllocation = signal<TournamentRefereeAllocation|undefined>(undefined);
  referees = signal<(SearchableReferee|undefined)[]>([])
  coaches = signal<(SearchableCoach|undefined)[]>([])
  showCoaches = signal<boolean>(true);
  showReferees = signal<boolean>(true);
  showRefereeLevel = signal<boolean>(true);
  showBadgeSystem = computed<boolean>(() => {
    return new Set(this.referees().map(ref => ref?.isPR ? undefined : ref?.attendee.referee?.badgeSystem)
      .filter(l => l != undefined)).size > 1;
  });
  showDivisionColor = signal<boolean>(false);
  highlightedRefereeIds = signal<(string|undefined)[]>([undefined,undefined]);
  gameCellStyle = computed<string>(() => {
    if (this.showReferees()) {
      return this.showCoaches() ? 'gameCell-withcoach' : 'gameCell-withoutcoach';
    } else {
      return 'gameCell-withoutreferee';
    }
  });
  selection = this.selectionService.currentSelection;

  constructor() {
    super();
    this.showCoaches.set(this.userService.getLocalUserProperty(KEY_SHOW_COACHES) ?? true);
    effect(() => {
      if (this.tournament()) {
        this.loadData();
      }
    });
    window.addEventListener('keydown', this.onKeyboard.bind(this));
  }

  /** Persists the user's preference for displaying referee coaches in the grid. */
  onShowCoachesChange(showCoaches: boolean): void {
    this.userService.setLocalUserProperty(KEY_SHOW_COACHES, showCoaches);
  }
  loadData() {
    this.loadingStartedAt = Date.now();
    this.loading.set(true);
    this.route.params.subscribe(params => {
      const fragmentRefereeAllocationId = params['fragmentAllocationId'] as string;
      const tournamentRefereeAllocationId = params['tournamentAllocationId'] as string;
      console.log('fragmentAllocationId',fragmentRefereeAllocationId, 'tournamentAllocationId', tournamentRefereeAllocationId)
      this.loadFragmentAllocation(fragmentRefereeAllocationId).pipe(
        mergeMap(() => this.loadTournamentAllocation(tournamentRefereeAllocationId)),
        mergeMap(() => this.loadAttendees()),
        map(() => this.buildDayView()),
        mergeMap((dayView:DayView) => this.loadGames(dayView)),
        mergeMap((dayView:DayView) => this.loadRefereeAllocations(dayView)),
        map((dayView:DayView) => this.day.set(dayView)),
        map(() => this.buildDayDescs()),
        take(1),
        finalize(() => this.finishLoading())
      ).subscribe({
        error: error => console.error('Unable to load the referee allocation', error)
      });
    });
  }

  /** Keeps the loading mask visible long enough to be perceptible during fast loads. */
  private finishLoading(): void {
    const elapsed = Date.now() - this.loadingStartedAt;
    const remaining = Math.max(0, this.minimumLoadingDisplayMs - elapsed);
    setTimeout(() => this.loading.set(false), remaining);
  }
  goToPart(partDay: PartDay|undefined = undefined) {
    let allocs = this.tournamentAllocation()!.fragmentRefereeAllocations.filter(fra => fra.dayId === this.day()!.id);
    if (allocs.length === 0) {
      return;
    }
    const partDayId = partDay ? partDay.id : undefined;
    const alloc = allocs.find(a => a.partDayId === partDayId);
    if (alloc) {
      this.routeToFragmentAllocation(alloc.id);
    }
  }
  /**
   * Opens an existing full-day allocation or asks to create it when the day has none.
   * @param dayDesc day navigation entry selected by the user
   */
  onDaySelectionChange(dayDesc: DayDesc): void {
    if (dayDesc.fragmentAllocationDesc) {
      this.routeToFragmentAllocation(dayDesc.fragmentAllocationDesc.id);
      return;
    }
    if (dayDesc.day.parts.length === 1 && dayDesc.partDescs.length === 1) {
      this.routeToFragmentAllocation(dayDesc.partDescs[0].id);
      return;
    }
    this.confirmationService.confirm({
      message: `Do you want to create the allocation of the Day ${dayDesc.day.id}?`,
      accept: () => this.createFullDayAllocation(dayDesc.day.id)
    });
  }

  /**
   * Creates and persists a full-day fragment for the selected tournament allocation.
   * @param dayId identifier of the day for the new allocation
   */
  private createFullDayAllocation(dayId: string): void {
    const tournamentAllocation = this.tournamentAllocation();
    if (!tournamentAllocation || tournamentAllocation.fragmentRefereeAllocations.some(
      allocation => allocation.dayId === dayId && allocation.partDayId === undefined
    )) return;

    const fragmentAllocation: FragmentRefereeAllocation = {
      id: '',
      name: `D${dayId}-${Math.floor(Math.random() * 100)}`,
      tournamentId: this.tournament()!.id,
      lastChange: new Date().getTime(),
      dayId,
      refereeAllocatorAttendeeIds: [],
      refereeCoachAllocatorAttendeeIds: [],
      visible: false
    };
    this.fragmentRefereeAllocationService.save(fragmentAllocation).pipe(
      mergeMap(savedAllocation => {
        const updatedTournamentAllocation: TournamentRefereeAllocation = {
          ...tournamentAllocation,
          fragmentRefereeAllocations: [
            ...tournamentAllocation.fragmentRefereeAllocations,
            { id: savedAllocation.id, dayId: savedAllocation.dayId }
          ]
        };
        return this.tournamentRefereeAllocationService.save(updatedTournamentAllocation).pipe(
          map(() => savedAllocation)
        );
      })
    ).subscribe({
      next: savedAllocation => this.routeToFragmentAllocation(savedAllocation.id),
      error: error => console.error('Unable to create the full-day referee allocation', error)
    });
  }
  routeToFragmentAllocation(fragmentAllocationId: string) {
    this.loadingStartedAt = Date.now();
    this.loading.set(true);
    this.router.navigate(['tournament', this.tournament()!.id, 'allocation',
      this.tournamentAllocation()!.id, 'fragment',fragmentAllocationId ]);
  }
  onHhighlightedRefereeChange(refereeId: string|undefined, idx: number) {
    const previousValue = this.highlightedRefereeIds();
    const newValue = previousValue.filter(() => true);
    if (refereeId) {
      newValue[idx] = refereeId;
    } else {
      newValue[idx] = undefined;
    }
    this.highlightedRefereeIds.set(newValue);
    // console.debug('Highlighted[', idx,'] changed from', previousValue, 'to', this.highlightedRefereeIds()[idx]);
  }
  private loadFragmentAllocation(refereeAllocationId: string): Observable<FragmentRefereeAllocation|undefined> {
    // console.debug('loadAllocation', refereeAllocationId);
    return this.fragmentRefereeAllocationService.byId(refereeAllocationId).pipe(
      map((allocation: any) => {
        console.log('Fragment allocation', allocation);
        this.allocation.set(allocation);
        return allocation;
      })
    );
  }
  private loadTournamentAllocation(refereeAllocationId: string): Observable<TournamentRefereeAllocation|undefined> {
    // console.debug('loadAllocation', refereeAllocationId);
    return this.tournamentRefereeAllocationService.byId(refereeAllocationId).pipe(
      map((allocation: any) => {
        this.tournamentAllocation.set(allocation);
        return allocation;
      })
    );
  }

  refereeToString(referee: Referee) {
    if(referee.isPR) {
      return 'PR: '+ referee.team?.name;
    } else {
      let label = referee.person?.firstName + ' ' + referee.person?.lastName;
      if (this.showRefereeLevel()) {
        label += ' (L'+referee.attendee!.referee!.badge + ( referee.attendee!.referee!.upgrade?.badge! > 0 ? '*': '');
        if (this.showBadgeSystem()) {
          label += '/'+referee.attendee!.referee!.badgeSystem;
        }
        label += ')';
      }
      return label;
    }
  }

  private loadAttendees(): Observable<any> {
    // console.debug('loadAttendees');
    return forkJoin([
      of(''),
      this.refereeService.findReferees(this.tournament()!).pipe(
        map(referees => this.referees.set(toSearchableReferees(referees))),
        take(1)
      ),
      this.refereeService.findRefereeCoaches(this.tournament()!.id).pipe(
        map(coaches => this.coaches.set(toSearchableCoaches(coaches))),
        take(1)
      )
    ]);
  }

  private buildDayView(): DayView {
    const dayId = this.allocation()!.dayId;
    const partDayId = this.allocation()!.partDayId;
    const day = this.tournament()!.days.find((day: Day) => day.id === dayId)!;
    const partDays = partDayId ? day.parts.filter((partDay: PartDay) => partDay.id === partDayId) : day.parts;
    const dayView: DayView = {
      ...day,
      dayNb: 1 + this.tournament()!.days.findIndex((day: Day) => day.id === dayId),
      label: this.dateService.toDate(day.date),
      partViews: partDays.map((partDay: PartDay) => this.buildPartView(partDay))
    };
    // console.debug('buildDayView()=>', dayView);
    return dayView;
  }

  private buildDayDescs() {
    this.days.set(this.tournament()!.days.map(day => {
      const dayDesc: DayDesc = {
        day,
        date: this.dateService.epochToDate(day.date),
        dayStr: this.dateService.toDate(day.date),
        current: this.allocation()!.dayId === day.id,
        partDescs: []
      };
      this.tournamentAllocation()!.fragmentRefereeAllocations.filter(fra => fra.dayId === day.id).forEach(fra => {
        if (fra.partDayId === undefined) {
          dayDesc.fragmentAllocationDesc = fra;
        } else {
          dayDesc.partDescs.push(fra);
        }
      });
      dayDesc.partDescs.sort((pd1,pd2) => {
        if (pd1.partDayId === undefined) return -1;
        if (pd2.partDayId === undefined) return 1;
        return pd1.partDayId.localeCompare(pd2.partDayId);
      })
      return dayDesc;
    }));
  }

  private buildPartView(partDay: PartDay): PartView {
    const availableFields = partDay.allFieldsAvaillable
      ? [...this.tournament()!.fields]
      : this.tournament()!.fields.filter((field: Field) => partDay.availableFieldIds.includes(field.id));
    availableFields.sort((a: Field, b: Field) => a.orderView - b.orderView);
    const partView: PartView = {
      ...partDay,
      timeSlotViews: partDay.timeslots.map((ts: Timeslot) => this.buildTimeSlotView(ts, availableFields)),
      fields: availableFields,
    };
    return partView;
  }

  private buildTimeSlotView(ts: Timeslot, availableFields: Field[]): TimeSlotView {
    return { ...ts,
      startStr: this.dateService.toTime(ts.start),
      endStr: this.dateService.toTime(ts.end),
      durationStr: this.dateService.toDuration(ts.duration),
      fields: availableFields.map((field: Field) => { return { ...field } as FieldView})
    };
  }

  private loadGames(dayView: DayView): Observable<DayView> {
    return this.gameService.byDay(this.tournament()!.id, dayView.id).pipe(
      map((games: Game[]) => {
        // console.log('loadGames', games);
        dayView.partViews.forEach((part: PartView) => {
          games.filter((game: Game) => game.partDayId === part.id).forEach((game: Game) => {
            const division = this.tournament()!.divisions.find((division: Division) => division.id === game.divisionId);
            const homeTeam = division ? division!.teams.find((team: Team) => team.id === game.homeTeamId) : undefined;
            const awayTeam = division ? division!.teams.find((team: Team) => team.id === game.awayTeamId) : undefined;
            const timeslot = part.timeSlotViews.find(ts => ts.id === game.timeslotId);
            const gv: GameView = {game, division, timeslot,
              timeslotStr: timeslot ? this.dateService.toTime(timeslot.start) : '',
              field: this.tournament()!.fields.find((field: Field) => field.id === game.fieldId),
              homeTeam,
              awayTeam,
              coaches: [],
              referees: []
            };
            const tsv: TimeSlotView|undefined = part.timeSlotViews.find((tsv: TimeSlotView) => tsv.id === game.timeslotId);
            if (tsv) {
              const fieldView: FieldView|undefined = tsv.fields.find((fieldView: FieldView) => fieldView.id === game.fieldId);
              if (fieldView) {
                fieldView.game = gv;
              }
            }
          });
        });
      }),
      map(() => dayView)
    );
  }

  loadRefereeAllocations(dayView: DayView): Observable<DayView> {
    // console.debug('loadRefereeAllocations', dayView);
    return this.gameAttendeeAllocationService.byAllocation(this.tournament()!.id, this.allocation()!.id).pipe(
      map((allocations: GameAttendeeAllocation[]) => {
        // console.log('allocations', allocations);
        dayView.partViews.forEach((part: PartView) => {
          part.timeSlotViews.forEach((tsv: TimeSlotView) => {
            tsv.fields.forEach((fv: FieldView) => {
              if (!fv.game) return;
              const gv = fv.game!;
              const gameAllocations = allocations.filter((allocation: GameAttendeeAllocation) =>
                allocation.gameId === gv.game.id && (allocation.attendeeRole === 'Coach' || allocation.attendeeRole === 'Referee'));
              // console.log('gameAllocations', gv.game.id, gameAllocations);
              gameAllocations.map((gameAllocation: GameAttendeeAllocation) => {
                const gav: GameAttendeeAllocationView = {attendeeAlloc: gameAllocation};
                if (gav.attendeeAlloc.attendeeRole === 'Referee') {
                  const referee: Referee|undefined = this.referees().find(r => r!.attendee.id === gav.attendeeAlloc.attendeeId);
                  if (referee) {
                    // console.log('gameAllocations', gv.game.id, gameAllocations, 'referee', referee);
                    gav.referee = referee;
                    gv.referees.push(gav);
                    gv.referees.sort((a1,a2) => a1.attendeeAlloc.attendeePosition - a2.attendeeAlloc.attendeePosition)
                  }
                } else if (gav.attendeeAlloc.attendeeRole === 'Coach') {
                  const coach: RefereeCoach|undefined = this.coaches().find(c => c!.attendee.id === gav.attendeeAlloc.attendeeId);
                  if (coach) {
                    console.log('gameAllocations', gv.game.id, gameAllocations, 'coach', coach);
                    gav.coach = coach;
                    gv.coaches.push(gav);
                    gv.coaches.sort((a1,a2) => a1.attendeeAlloc.attendeePosition - a2.attendeeAlloc.attendeePosition)
                  }
                }
              });
            });
          });
        });
        this.removeFieldsWithoutGames(dayView);
        return dayView;
      })
    );
  }

  /**
   * Keeps only fields that contain at least one game in the displayed part.
   * The same field list is applied to headers and timeslot rows.
   * @param dayView day view whose empty field columns must be removed
   */
  private removeFieldsWithoutGames(dayView: DayView): void {
    dayView.partViews.forEach((part: PartView) => {
      const fieldIdsWithGames = new Set(
        part.timeSlotViews.flatMap(ts => ts.fields.filter(field => field.game).map(field => field.id))
      );
      part.fields = part.fields.filter(field => fieldIdsWithGames.has(field.id));
      part.timeSlotViews.forEach(ts => {
        ts.fields = ts.fields.filter(field => fieldIdsWithGames.has(field.id));
      });
    });
  }
  allocationNameChanged() {
    this.fragmentRefereeAllocationService.save(this.allocation()!).pipe(take(1)).subscribe();
  }
  onKeyboard(event: KeyboardEvent) {
    const select = this.selectionService.currentSelection();
    if (!select) {
      if (event.key === 'Enter') {
        if (this.day()!.partViews[0].fields.length === 0) return;
        this.selectionService.setCurrentSelection({
          tournamentId: this.tournament()!.id,
          viewName: 'Appointments',
          partId: this.day()!.partViews[0].id,
          partIdx: 0,
          timeslotId: this.day()!.partViews[0].timeSlotViews[0].id,
          timeslotIdx: 0,
          fieldId: this.day()!.partViews[0].fields[0].id,
          fieldIdx: 0,
          cellType: this.showCoaches() ? 'Coach' : 'Referee',
          inCellPosition: 0,
          nbLine: 1
        });
      }
      return;
    }
    let newSelection: SelectionDescriptor|null = {...select};
    let cas;
    const previousNbLine = newSelection.nbLine;
    newSelection.nbLine = 1;
    switch (event.key) {
      case 'Enter':
        newSelection.cellType = (select.inCellPosition > 0 || this.showReferees()) ? 'Referee' : 'Coach';
        break;
      case 'Esc':
      case 'Escape':
        newSelection.cellType = 'None';
        break;
      case 'ArrowUp':
        event.preventDefault(); // évite le scroll
        if (select.cellType === 'Referee' && select.inCellPosition > 0) {
          newSelection.inCellPosition--;
          if (event.shiftKey) {
            newSelection.nbLine = previousNbLine+1;
          }
          cas = 'up to previous referee';
        } else if (select.cellType === 'Referee' && select.inCellPosition === 0 && this.showCoaches()) {
          newSelection.cellType = 'Coach';
          newSelection.inCellPosition = 0;
          cas = 'up to coach';
        } else if (select.timeslotIdx > 0) {
          newSelection.timeslotIdx--;
          newSelection.cellType = 'Referee';
          newSelection.inCellPosition = 2;
          cas = 'up to previous timeslot';
        } else if (select.partIdx > 0) {
          newSelection.partIdx--;
          newSelection.timeslotIdx = this.day()!.partViews[newSelection.partIdx].timeSlotViews.length - 1;
          newSelection.cellType = 'Referee';
          newSelection.inCellPosition = 2;
          cas = 'up to previous part';
        } else {
          newSelection = null;
        }
        break;
      case 'ArrowDown':
        event.preventDefault(); // évite le scroll
        if (select.cellType === 'Referee' && select.inCellPosition < 2) {
          if (event.shiftKey) {
            newSelection.nbLine = previousNbLine+1;
          } else {
            newSelection.inCellPosition++;
          }
          cas = 'down to next referee';
        } else if (select.cellType === 'Coach' && this.showReferees()) {
          newSelection.cellType = 'Referee';
          newSelection.inCellPosition = 0;
          cas = 'down to the 1st referee';
        } else if (select.timeslotIdx < this.day()!.partViews[select.partIdx].timeSlotViews.length - 1) {
          newSelection.timeslotIdx++;
          newSelection.cellType = 'Coach';
          newSelection.inCellPosition = 0;
          cas = 'down to next timeslot';
        } else if (select.partIdx < this.day()!.partViews.length - 1) {
          newSelection.partIdx++;
          newSelection.timeslotIdx = this.day()!.partViews[newSelection.partIdx].timeSlotViews.length + 1;
          newSelection.cellType = 'Coach';
          newSelection.inCellPosition = 0;
          cas = 'down to next part';
        } else {
          newSelection = null;
        }
        break;
      case 'ArrowLeft':
        event.preventDefault(); // évite le scroll
        if (select.fieldIdx > 0) {
          newSelection.fieldIdx--;
          cas = 'left to field';
        } else {
          newSelection = null;
        }
        break;
      case 'ArrowRight':
        event.preventDefault(); // évite le scroll
        if (select.fieldIdx < this.day()!.partViews[select.partIdx].fields.length - 1) {
          newSelection.fieldIdx++;
          cas = 'right to field';
        } else {
          newSelection = null;
        }
        break;
      case 'c':
      case 'x': {
        newSelection = null;
        const game = this.day()!.partViews[select.partIdx].timeSlotViews[select.timeslotIdx].fields[select.fieldIdx].game;
        if (event.ctrlKey && game && (select.cellType === 'Referee' || select.cellType === 'Coach')) {
          const action: ClipboardItem = {
            clipboardAction: event.key === 'c' ? 'Copy' : 'Cut',
            tournamentId: this.tournament()!.id,
            viewName: 'Appointments',
            type: select.cellType === 'Referee' ? 'Referee' : 'Coaches',
            attendeeIds: select.cellType === 'Referee' ?
              game.referees
                .filter(r => select.inCellPosition <= r.attendeeAlloc.attendeePosition
                    && r.attendeeAlloc.attendeePosition <= select.inCellPosition + select.nbLine -1)
                .map(r => r.referee!.attendee.id)
              :
              game.coaches.map(c => c.coach!.attendee.id),
            partId: select.partId,
            partIdx: select.partIdx,
            timeslotId: select.timeslotId,
            timeslotIdx: select.timeslotIdx,
            fieldId: select.fieldId,
            fieldIdx: select.fieldIdx,
            gameId: game.game.id
          }
          console.debug('Copy to clipboard ', action);
          this.selectionService.clipboard = action;
        }
        break;
      }
      case 'v': {
        newSelection = null;
        const game = this.day()!.partViews[select.partIdx].timeSlotViews[select.timeslotIdx].fields[select.fieldIdx].game;
        if (event.ctrlKey && game && this.selectionService.clipboard &&
          ((this.selectionService.clipboard.type === 'Coaches' && select.cellType === 'Coach')
            || (this.selectionService.clipboard.type === 'Referee' && select.cellType === 'Referee'))
        ) {
          const action: AllocationAction = {
            action: select.cellType === 'Coach' ? 'SetRefereeCoach' : 'SetReferee',
            allocationId: this.allocation()!.id,
            attendeeIds: this.selectionService.clipboard.attendeeIds,
            fieldId: select.fieldId,
            fieldIdx: select.fieldIdx,
            partId: select.partId,
            partIdx: select.partIdx,
            gameId: game.game.id,
            inCellPosition: select.inCellPosition,
            timeslotId: select.timeslotId,
            timeslotIdx: select.timeslotIdx,
            tournamentId: this.tournament()!.id
          }
          console.debug('Paste from clipboard. action', action);
          this.selectionService.emitAction(action);

          if (this.selectionService.clipboard.clipboardAction === 'Cut') {
            for (let i=0; i<select.nbLine; i++) {
              const actionDel: AllocationAction = {
                action: select.cellType === 'Coach' ? 'DeleteRefereeCoach' : 'DeleteReferee',
                allocationId: this.allocation()!.id,
                attendeeIds: this.selectionService.clipboard.attendeeIds,
                fieldId: this.selectionService.clipboard.fieldId,
                fieldIdx: this.selectionService.clipboard.fieldIdx,
                partId: this.selectionService.clipboard.partId,
                partIdx: this.selectionService.clipboard.partIdx,
                timeslotId: this.selectionService.clipboard.timeslotId,
                timeslotIdx: this.selectionService.clipboard.timeslotIdx,
                gameId: this.selectionService.clipboard.gameId,
                inCellPosition: select.inCellPosition + i,
                tournamentId: this.tournament()!.id
              }
              console.debug('Paste from clipboard. action del', actionDel);
              this.selectionService.emitAction(actionDel);
            }
            this.selectionService.clipboard = undefined;
          }
        }
        break;
        }
      case 'Delete':{
        newSelection = null;
        const game = this.day()!.partViews[select.partIdx].timeSlotViews[select.timeslotIdx].fields[select.fieldIdx].game;
        if (game && (select.cellType === 'Coach' || select.cellType === 'Referee')) {
          const actionDel: AllocationAction = {
            action: select.cellType === 'Coach' ? 'DeleteRefereeCoach' : 'DeleteReferee',
            allocationId: this.allocation()!.id,
            attendeeIds: [],
            fieldId: select.fieldId,
            fieldIdx: select.fieldIdx,
            partId: select.partId,
            partIdx: select.partIdx,
            gameId: game.game.id,
            inCellPosition: select.inCellPosition,
            timeslotId: select.timeslotId,
            timeslotIdx: select.timeslotIdx,
            tournamentId: this.tournament()!.id
          }
          console.debug('Delete action', actionDel);
          this.selectionService.emitAction(actionDel);
        }
        break;
        }
      case 'Home':
        event.preventDefault(); // évite le scroll
        newSelection.fieldIdx = 0;
        cas = 'Home to field';
        break;
      case 'End':
        event.preventDefault(); // évite le scroll
        newSelection.fieldIdx = this.day()!.partViews[select.partIdx].fields.length - 1;
        cas = 'End to field';
        break;
      default:
        newSelection = null;
        break;
    }
    if (newSelection) {
      const game = this.day()!.partViews[newSelection.partIdx].timeSlotViews[newSelection.timeslotIdx].fields[newSelection.fieldIdx].game;
      if (game) {
        if (!this.showReferees() && newSelection.cellType === 'Referee') {
          newSelection.cellType = 'Coach';
          newSelection.inCellPosition = 0;
        } else if (!this.showCoaches() && newSelection.cellType === 'Coach') {
          newSelection.cellType = 'Referee';
          newSelection.inCellPosition = 0;
        }
      } else {
        newSelection.cellType = 'EmptySlot';
      }

      newSelection.partId     = this.day()!.partViews[newSelection.partIdx].id;
      newSelection.timeslotId = this.day()!.partViews[newSelection.partIdx].timeSlotViews[newSelection.timeslotIdx].id;
      newSelection.fieldId    = this.day()!.partViews[newSelection.partIdx].fields[newSelection.fieldIdx].id;
      // console.debug('Selection changed (', cas, '): ', select, '=>', newSelection);
      this.selectionService.setCurrentSelection(newSelection);
    }
  }
}
interface DayDesc {
  current: boolean;
  day: Day;
  date: Date;
  dayStr: string;
  fragmentAllocationDesc?: FragmentRefereeAllocationDesc;
  partDescs: FragmentRefereeAllocationDesc[];
}
