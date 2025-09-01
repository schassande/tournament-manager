import { Component, computed, effect, inject, input, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { GameAttendeeAllocation, Referee, RefereeAllocation, RefereeCoach } from '../data.model';
import { GameAttendeeAllocationView, GameView } from '../allocation-data-model';

import { GameAttendeeAllocationService } from '../service/game-attendee-allocation.service';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { AllocationAction, SelectionService } from '../service/selection.service';
import { Subscription } from 'rxjs';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, MultiSelectModule, SelectModule],
  selector: 'app-game-referee-allocator',
  template: `
  <div>
    <div class="teamsCell" style="{{teamsCellStyle()}}">{{game().division!.shortName}}: {{game().homeTeam?.shortName}} - {{game().awayTeam?.shortName}}</div>
    @if (showCoaches() && coaches()) {
      <div class="coaches {{ coachCellSelected() ? 'selectable':''}}">
        <p-multiselect [options]="coaches()" [ngModel]="_gameCoachIds" optionLabel="shortLabel" optionValue="id"
          style="text-align: center;" size="small"
          [maxSelectedLabels]="3" [selectionLimit]="3"
          style="width: 250px" display="chip"
          class="auto-grow" [filter]="true" (onChange)="coachesSelected($event.value)">
          <ng-template let-coach #items>
            <span style="color: {{coach!.person!.refereeCoach!.fontColor}}; background-color: {{coach!.person!.refereeCoach!.backgroundColor}};">
                {{ coach.shortLabel }}
            </span>
          </ng-template>
        </p-multiselect>
      </div>
    }
    @if (showReferees() && referees()) {
    <div class="referees">
      @for(gameRefereeId of _gameRefereeIds;  let idx = $index; track idx) {
        <div class="{{ selection() && refereeCellSelected() >=0
            && refereeCellSelected() <= idx && idx <= (refereeCellSelected()+selection()!.nbLine-1)  ? 'selectable' : ''}}">
          <p-select [options]="referees()" [ngModel]="gameRefereeId" optionValue="id"
            (onChange)="refereeSelected($event.value, idx)"
            [filter]="true" filterBy="search"
            class="{{highlights()[idx]}}" style="width: 250px;" size="small"
            (clear)="clearReferee(idx)" [showClear]="true">

            <ng-template #selectedItem let-referee>
              <div style="text-align: left; width: 300px;">
              @if (referee.isPR) {
                PR: {{referee.team?.name}}
              } @else {
                {{referee.person.firstName}} {{referee.person.lastName}}
                @if(showRefereeLevel()) {
                  (L{{referee.attendee.referee.badge}}{{referee.attendee.referee.upgrade?.badge > 0 ? '*': ''}}
                  @if (showBadgeSystem()) {
                    /{{referee.attendee.referee.badgeSystem}}
                  })
                }
              }
              </div>
            </ng-template>

            <ng-template #item let-referee>
              <span>
                @if(referee) {
                  @if (referee.isPR) {
                    PR: {{referee.team?.name}}
                  } @else {
                    {{referee.person.firstName}} {{referee.person.lastName}}
                    @if(showRefereeLevel()) {
                      (L{{referee.attendee.referee.badge}}{{referee.attendee.referee.upgrade?.badge > 0 ? '*': ''}}
                      @if (showBadgeSystem()) {
                        /{{referee.attendee.referee.badgeSystem}}
                      })
                    }
                  }
                }
              </span>
            </ng-template>
          </p-select>
        </div>
      }
    </div>
    }
  </div>`,
  styles: [`
    .teamsCell { padding: 5px; }
    .coaches { height: 40px; border-top: 1px lightgrey solid;}
    .coaches p-multiselect { height: 40px;}
    .coachShortName {
       text-align: center;
       padding: 2px 6px;
       border-radius: 4px;
       margin-right: 4px;
       display: inline-block;
    }
    .selectable.coaches   { height: 50px !important; margin-top: 10px;}
  `],
})
export class GameRefereeAllocatorComponent implements OnInit, OnDestroy {
  gameAttendeeAllocationService = inject(GameAttendeeAllocationService);
  selectionService = inject(SelectionService);

  // Input parameters //
  game = input.required<GameView>();
  referees = input.required<(SearchableReferee|undefined)[]>()
  coaches = input.required<(SearchableCoach|undefined)[]>()
  allocation = input.required<RefereeAllocation>();
  showCoaches = input.required<boolean>();
  showReferees = input.required<boolean>();
  showRefereeLevel = input.required<boolean>();
  showBadgeSystem = input.required<boolean>();
  showDivisionColor = input.required<boolean>();
  highlightedRefereeIds = input.required<(string|undefined)[]>();
  lastRefereeChange = signal(0);
  lastCoachChange = signal(0);

  selection = this.selectionService.currentSelection;
  coachCellSelected = computed<boolean>(() => {
    const select = this.selection();
    const game = this.game().game;
    if (!select) return false;
    return select.cellType === 'Coach'
      && select.tournamentId === game.tournamentId
      && select.fieldId === game.fieldId
      && select.timeslotId === game.timeslotId;
  });
  refereeCellSelected = computed<number>(() => {
    const select = this.selection();
    const game = this.game().game;
    if (!select) return -1;
    if ( select.cellType === 'Referee'
      && select.tournamentId === game.tournamentId
      && select.fieldId === game.fieldId
      && select.timeslotId === game.timeslotId) {
        return select.inCellPosition;
    } else {
      return -1;
    }
  });

  // Internal state //
  gameRefereeIds = [
    computed<string|undefined>(() => this.computeGameRefereeId(0)),
    computed<string|undefined>(() => this.computeGameRefereeId(1)),
    computed<string|undefined>(() => this.computeGameRefereeId(2))
  ];
  _gameRefereeIds: (string|undefined)[] = [undefined, undefined, undefined];

  highlights = computed<(string|undefined)[]>(() => {
    this.lastRefereeChange();
    const hlrIds = this.highlightedRefereeIds();
    const styles = this.gameRefereeIds.map((refereeAttendeeId) => {
      if (hlrIds && refereeAttendeeId()) {
        const idxHl = hlrIds.findIndex(hlrId => refereeAttendeeId() === hlrId);
        if (idxHl >= 0) return 'referee-highlight-' + idxHl;
      }
      return '';
    });
    // console.log('GameRefereeAllocator.computeHighLight', 'highlights', styles);
    return styles;
  });
  _highlights: (string|undefined)[] = ['', '', ''];

  gameCoachIds = computed<string[]>(() =>{
    this.lastCoachChange();
    const res:string[] = this.game()
      .coaches.map(gav => gav.coach?.attendee.id)
      .filter(id => id !== undefined);
    /*if (this.game().coaches.length > 0) {
      console.log('GameRefereeAllocator.computeCoachId',
        '\n-gameId', this.game().game.id,
        '\n-game().coaches', this.game().coaches,
        '\n-gameCoaches()', res,
        '\n-coaches()', this.coaches() );
    }*/
    return res;
  });
  _gameCoachIds: string[] = [];

  fullyAllocated = computed(() => {
    this.lastRefereeChange();
    return this.gameRefereeIds
      .map(ref => ref() !== undefined)
      .reduce((prev, cur) => prev && cur, true);
  });
  teamsCellStyle = computed<string>(() => {
    if (this.showDivisionColor()) {
      return `background-color: {{game().division?.backgroundColor}}; color: {{game().division?.fontColor}}`;
    } else return '';
  });
  private sub!: Subscription;
  constructor() {
    effect(() => this._gameRefereeIds[0] = this.gameRefereeIds[0]());
    effect(() => this._gameRefereeIds[1] = this.gameRefereeIds[1]());
    effect(() => this._gameRefereeIds[2] = this.gameRefereeIds[2]());
    effect(() => this._highlights = this.highlights());
    effect(() => this._gameCoachIds = this.gameCoachIds());
  }
  ngOnInit(): void {
    this.sub = this.selectionService.action$.subscribe(action => this.performAction(action));
  }
  ngOnDestroy(): void {
      this.sub.unsubscribe();
  }
  performAction(action: AllocationAction) {
    if (action.allocationId !== this.allocation().id
      || action.gameId !== this.game().game.id)
      return;
    switch(action.action) {
      case 'DeleteReferee':
        console.log('Action on cell','timeSlot:', this.game().timeslotStr, 'field:',this.game().field?.name, 'delete referee in position', action.inCellPosition);
        this._gameRefereeIds[action.inCellPosition] = undefined;
        this.clearReferee(action.inCellPosition);
        break;
      case 'DeleteRefereeCoach':
        console.log('Action on cell','timeSlot:', this.game().timeslotStr, 'field:',this.game().field?.name, 'DeleteRefereeCoach');
        this._gameCoachIds = [];
        this.coachesSelected([]);
        break;
      case 'SetReferee':
        action.attendeeIds.forEach((attendeeId, i) => {
          console.log('Action on cell','timeSlot:', this.game().timeslotStr, 'field:',this.game().field?.name, 'SetReferee', attendeeId, action.inCellPosition + i);
          const pos = action.inCellPosition + i;
          this._gameRefereeIds[pos] = attendeeId;
          this.refereeSelected(attendeeId, pos);
        });
        break;
      case 'SetRefereeCoach':
        console.log('Action on cell','timeSlot:', this.game().timeslotStr, 'field:',this.game().field?.name, 'DeleteRefereeCoach', action.attendeeIds);
        this._gameCoachIds = action.attendeeIds;
        this.coachesSelected(action.attendeeIds);
        break;
    }
  }
  computeGameRefereeId(pos: number) {
    this.lastRefereeChange();
    let refs = this.game().referees.filter(rav => rav.referee?.attendee.isReferee && rav.attendeeAlloc.attendeePosition === pos);
    if (refs.length > 1) {
      this.autoClean();
      refs = this.game().referees.filter(rav => rav.referee?.attendee.isReferee && rav.attendeeAlloc.attendeePosition === pos);
    }
    let res: string|undefined;
    if (refs.length === 0) {
      res = undefined;
    } else {
      res = refs[0].referee?.attendee.id
    }
    // console.log('GameRefereeAllocator.computeGameRefereeId', pos, res);
    return res;
  }
  autoClean() {
    const gameRefs = this.game().referees.filter(rav => rav.referee?.attendee.isReferee)
    for(let i=0; i<3; i++) {
      const toRemove = gameRefs.filter(rav => rav.attendeeAlloc.attendeePosition === i)
      toRemove.sort((rav1,rav2) => rav1.attendeeAlloc.lastChange - rav2.attendeeAlloc.lastChange);
      toRemove.pop();
      if (toRemove.length <= 1) continue;
      console.error('More than 1 referees on the game at position '+i+': ', toRemove);
      toRemove.forEach(rav => {
        console.log('Auto-cleaning allocation', rav);
        this.gameAttendeeAllocationService.delete(rav.attendeeAlloc.id);
        this.game().referees = this.game().referees.filter(r => r.attendeeAlloc.id !== rav.attendeeAlloc.id);
      });
    }
    this.lastRefereeChange.set(this.lastRefereeChange() + 1);
  }
  refereeSelected(refereeAttendeeId: string, idx:number) {
    const existingIdx = this.game().referees.findIndex(r => r.attendeeAlloc.attendeePosition === idx);
    const rav: GameAttendeeAllocationView|undefined = existingIdx >= 0 ? this.game().referees[existingIdx] : undefined;
    const referee = refereeAttendeeId ? this.referees().find(r => r?.id === refereeAttendeeId) : undefined;
    if (referee) {
      if (rav) {
        console.log('Update allocation with the new selected referee', idx, referee, rav);
        rav.attendeeAlloc.attendeeId = referee.attendee.id;
        rav.referee = referee;
        this.gameAttendeeAllocationService.save(rav.attendeeAlloc).subscribe();
      } else {
        console.log('Create allocation with the selected referee', idx, referee);
        const newAlloc: GameAttendeeAllocation = {
          id: '',
          lastChange: new Date().getTime(),
          attendeeId: referee.attendee.id,
          attendeePosition: idx,
          attendeeRole: 'Referee',
          tournamentId: this.game().game.tournamentId,
          refereeAllocationId: this.allocation().id,
          half: 0,
          gameId: this.game().game.id,
        }
        this.gameAttendeeAllocationService.save(newAlloc).subscribe(savedAlloc => {
          console.log('Allocation created', savedAlloc);
          // create the GAV view and add it to the game
          const gav = {attendeeAlloc: savedAlloc, referee: referee };
          this.game().referees.push(gav);
        });
      }
    } else {
      if (refereeAttendeeId) {
        console.log('ERROR: referee ',refereeAttendeeId, 'not found among', this.referees());
        return;
      }
      if (rav) {
        console.log('Delete the previous allocation', idx, rav);
        this.gameAttendeeAllocationService.delete(rav.attendeeAlloc.id);
      } else {
        console.log('Still no referee selected on position ', idx);
      }
    }
    this.lastRefereeChange.set(this.lastRefereeChange() + 1);
  }

  clearReferee(idx: number) {
    const gavs = this.game().referees.filter(gav => gav.attendeeAlloc.attendeePosition === idx);
    for (let gav of gavs) {
      console.debug('Delete referee allocation', idx, gav);
      this.gameAttendeeAllocationService.delete(gav.attendeeAlloc.id);
    }
    this.lastRefereeChange.set(this.lastRefereeChange() + 1);
  }

  coachesSelected(attendeeIds: string[]) {
    console.debug('coachesSelected', attendeeIds);
    const coaches: RefereeCoach[] = this.coaches().filter(c => c && attendeeIds.includes(c.attendee.id)) as RefereeCoach[];

    // search coaches to deallocate among already allocated coach
    const toRemove: GameAttendeeAllocationView[] = [];
    this.game().coaches.forEach(gav => {
      if (gav.attendeeAlloc.attendeeRole === 'Coach'
        && !coaches.find(c => c.attendee.id === gav.attendeeAlloc.attendeeId)) {
        toRemove.push(gav);
      }
    });
    toRemove.forEach(gav => {
        console.debug('Delete coach allocation', gav);
        this.gameAttendeeAllocationService.delete(gav.attendeeAlloc.id);
        this.game().coaches = this.game().coaches.filter(c => c.coach?.attendee.id !== gav.coach?.attendee.id);
    });

    // Search new allocated coaches
    coaches.forEach((coach) => {
      const gav = this.game().coaches.find(gav => gav.attendeeAlloc.attendeeId === coach.attendee.id);
      if (gav) {
        console.log('Already existing allocation with the selected coach', coach);
      } else { // need to create the allocation
        console.log('Create allocation with the selected coach', coach);
        const newAlloc: GameAttendeeAllocation = {
          id: '',
          lastChange: new Date().getTime(),
          attendeeId: coach.attendee.id,
          attendeePosition: 0, // always 0 for coaches
          attendeeRole: 'Coach',
          tournamentId: this.game().game.tournamentId,
          refereeAllocationId: this.allocation().id,
          half: 0,
          gameId: this.game().game.id,
        }
        this.gameAttendeeAllocationService.save(newAlloc).subscribe(savedAlloc => {
          console.log('Allocation created', savedAlloc);
          // create the GAV view and add it to the game
          const gav = {attendeeAlloc: savedAlloc, coach: coach };
          this.game().coaches.push(gav);
        });
      }
    });
    this.lastCoachChange.set(this.lastRefereeChange() + 1);
  }
}

export interface SearchableReferee extends Referee {
  search: string;
  id: string;
}
export function toSearchableReferees(referees: (Referee|undefined)[]): (SearchableReferee|undefined)[] {
  return referees.map(r => toSearchableReferee(r));
}
export function toSearchableReferee(referee: Referee|undefined): SearchableReferee|undefined {
  if (referee == undefined) {
    return undefined;
  } else {
    const sr: SearchableReferee = referee as any;
    if (sr.isPR) {
      sr.search = 'PR ' + sr.team?.name + ' ' + sr.team?.divisionName;
    } else {
      sr.search =
        referee.person?.firstName + ' ' + referee.person?.lastName + ' ' + referee.person?.shortName
        'L'+referee.attendee!.referee!.badge + ( referee.attendee!.referee!.upgrade?.badge! > 0 ? '*': '')
    }
    sr.id = referee.attendee.id;
    return sr;
  }
}
export interface SearchableCoach extends RefereeCoach {
  search: string;
  shortLabel: string;
  fullLabel: string
  id: string
}
export function toSearchableCoaches(coaches: (RefereeCoach|undefined)[]): (SearchableCoach)[] {
  return coaches.map(c => toSearchableCoach(c)).filter(c => c !== undefined) as SearchableCoach[];
}
export function toSearchableCoach(coach: RefereeCoach|undefined): SearchableCoach|undefined {
  if (coach == undefined || coach.person == undefined) {
    return undefined;
  } else {
    const sc: SearchableCoach = coach as any;
    sc.search = coach.person!.firstName + ' ' + coach.person!.lastName + ' ' + coach.person!.shortName;
    sc.fullLabel = coach.person!.firstName + ' ' + coach.person?.lastName + '(' +coach.person!.shortName +')';
    sc.shortLabel = coach.person!.shortName && coach.person!.shortName.length > 0
      ? coach.person!.shortName
      : sc.fullLabel;
    sc.id = coach.attendee.id;
    return sc;
  }
}

