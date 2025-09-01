import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, map, mergeMap, Observable, of, take } from 'rxjs';

import { AbstractTournamentPage } from '../component/tournament-abstract.page';
import { Day, Division, Field, Game, GameAttendeeAllocation, PartDay, Referee, RefereeAllocation, RefereeCoach, Team, Timeslot } from '../data.model';
import { DayView, FieldView, GameAttendeeAllocationView, GameView, PartView, TimeSlotView } from '../allocation-data-model';

import { DateService } from '../service/date.service';
import { GameAttendeeAllocationService } from '../service/game-attendee-allocation.service';
import { GameService } from '../service/game.service';
import { RefereeAllocationService } from '../service/referee-allocation.service';
import { RefereeService } from '../service/referee.service';
import { GameRefereeAllocatorComponent, SearchableReferee, SearchableCoach, toSearchableCoaches, toSearchableReferees } from '../component/game-referee-allocator.component';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { AllocationAction, ClipboardItem, SelectionDescriptor, SelectionService } from '../service/selection.service';

@Component({
  selector: 'app-tournament-referees-allocation',
  imports: [CommonModule, FormsModule, GameRefereeAllocatorComponent, InputTextModule, SelectModule, ToggleSwitchModule],
  template: `
  @if(day() && allocation()) {
    <h2>Allocation of the referees and referees coaches on day {{day()?.label}}</h2>
    <div style="text-align: center; margin-bottom: 10px;">
      <span><label>Name: </label><input type="text" pInputText [(ngModel)]="allocation()!.name" (change)="allocationNameChanged()" size="small"/></span>
      <span style="margin-left: 10px; font-size: 0.8em;">{{referees().length}} referees and {{coaches().length}} referee coaches.</span>
      <p-toggleswitch [(ngModel)]="showCoaches" style="vertical-align: middle; margin-left: 10px;" size="small"></p-toggleswitch>
    </div>

    <div style="text-align: center;">
      <div style="width: 55px; display: inline-block; text-align: center; font-weight: bold;">Day {{day()!.dayNb}}</div>
      @if (showReferees()) {
        @for(hlrId of highlightedRefereeIds(); let idx=$index; track idx) {
          <p-select [options]="referees()" [ngModel]="highlightedRefereeIds()[idx]" (onChange)="onHhighlightedRefereeChange($event.value, idx)"
            optionValue="id"
            style="width: 250px; margin-right: 10px;"
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
    </div>
    @for(part of day()!.partViews; track part.id) {
      @if (day()!.partViews.length > 1) {
      <h3>Part {{ part.id }}</h3>
      }
      <table style="margin: auto;">
        <tr class="tableRowTitle">
          <th>Slot</th>
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
    }
  }
  `,
  styles: [`
    h2 { text-align: center; padding-top: 10px;}
    .fieldCol { width: 250px;}
    .noGameCell { background-color: #eeeeee; }
    .gameCell { background-color: #ffffff;  vertical-align: top;}
    .tableRowItem .timeslotCell { font-weight: bold; }
    .tableRowTitle th, .tableRowItem td {
      text-align: center;
      border: 2px grey solid;
    }
    .tableRowTitle th, .timeslotCell {
      padding: 10px 5px;
    }
    `],
  standalone: true
})
export class TournamentRefereesAllocationComponent extends AbstractTournamentPage  {

  private activatedRoute = inject(ActivatedRoute);
  private refereeService = inject(RefereeService);
  private dateService = inject(DateService);
  private gameService = inject(GameService);
  private gameAttendeeAllocationService = inject(GameAttendeeAllocationService);
  private refereeAllocationService = inject(RefereeAllocationService);
  private selectionService = inject(SelectionService);

  day = signal<DayView|undefined>(undefined);
  allocation = signal<RefereeAllocation|undefined>(undefined);
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
    effect(() => {
      if (this.tournament()) {
        const refereeAllocationId = this.activatedRoute.snapshot.paramMap.get('allocationId') as string;
        this.loadAllocation(refereeAllocationId).pipe(
          mergeMap(() => this.loadAttendees()),
          map(() => this.buildDayView()),
          mergeMap((dayView:DayView) => this.loadGames(dayView)),
          mergeMap((dayView:DayView) => this.loadRefereeAllocations(dayView)),
          map((dayView:DayView) => this.day.set(dayView)),
        ).subscribe();
      }
    });
    window.addEventListener('keydown', this.onKeyboard.bind(this));
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
  private loadAllocation(refereeAllocationId: string): Observable<RefereeAllocation|undefined> {
    // console.debug('loadAllocation', refereeAllocationId);
    return this.refereeAllocationService.byId(refereeAllocationId).pipe(
      map((allocation: any) => {
        console.log('allocation', allocation);
        this.allocation.set(allocation);
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
    // console.debug('buildDayView');
    const dayId = this.allocation()!.dayId;
    const partDayId = this.allocation()!.partDayId;
    const day = this.tournament()!.days.find((day: Day) => day.id === dayId)!;
    const partDays = partDayId ? day.parts.filter((partDay: PartDay) => partDay.dayId === dayId) : day.parts;
    const dayView: DayView = {
      ...day,
      dayNb: 1 + this.tournament()!.days.findIndex((day: Day) => day.id === dayId),
      label: this.dateService.toDate(day.date),
      partViews: partDays.map((partDay: PartDay) => this.buildPartView(partDay))
    };
    // console.debug('buildDayView()=>', dayView);
    return dayView;
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
      fields: availableFields.map((field: Field) => { return { ...field }})
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
        return dayView;
      })
    );
  }
  allocationNameChanged() {
    this.refereeAllocationService.save(this.allocation()!).pipe(take(1)).subscribe();
  }
  onKeyboard(event: KeyboardEvent) {
    const select = this.selectionService.currentSelection();
    if (!select) {
      if (event.key === 'Enter') {
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
