import { GameAttendeeAllocationService } from './../../shared/services/game-attendee-allocation.service';
import { Component, computed, effect, inject, input, OnInit, signal } from '@angular/core';
import { Attendee, Division, Field, Game, GameAttendeeAllocation, Person, Referee, RefereeAllocation, RefereeCoach, Team, Timeslot } from 'src/app/shared/data.model';
import { GameAttendeeAllocationView, GameView } from './allocation-data-model';

@Component({
  standalone: false,
  selector: 'app-game-referee-allocator',
  template: `
<div>
    <div class="teamsCell" style="background-color: {{game().division?.backgroundColor}}; color: {{game().division?.fontColor}}">{{game().division!.shortName}}: {{game().homeTeam?.shortName}} - {{game().awayTeam?.shortName}}</div>
    <div class="coaches">
      <ng-select [items]="coaches()" bindValue="gameCoaches()" [multiple]="true" style="text-align: center;"
        [dropdownPosition]="'right'" class="auto-grow" [searchFn]="coachMatchKey" (change)="coachesSelected($event)">
        <ng-template ng-option-tmp let-coach="item" let-index="index">
          <div style="text-align: left; width: 300px;">
            {{coach.person.firstName}} {{coach.person.lastName}} ({{coach.person.shortName}})
          </div>
        </ng-template>
        <ng-template ng-label-tmp let-coach="item" let-index="index">
          <span class="coachShortName" style="text-align: center; color: {{coach!.attendee!.refereeCoach!.fontColor}}; background-color: {{coach!.attendee!.refereeCoach!.backgroundColor}}">
            {{coach.person.shortName}}
          </span>
        </ng-template>
      </ng-select>
    </div>
    <div class="referees">
      @for(gameReferee of gameReferees; track gameReferee()?.attendee!.id; let idx = $index) {
        <ng-select [items]="referees()" [(ngModel)]="gameReferee"
          [dropdownPosition]="'right'" class="auto-grow" [searchFn]="refereeMatchKey"
          (change)="refereeSelected(idx, $event)" (clear)="clearReferee(idx)">
          <ng-template ng-option-tmp let-referee="item" let-index="index">
            <div style="text-align: left; width: 300px;">
            @if (referee.isPR) {
              PR: {{referee.team?.name}}
            } @else {
              {{referee.person.firstName}} {{referee.person.lastName}} (L{{referee.attendee.referee.badge}}{{referee.attendee.referee.upgrade?.badge > 0 ? '*': ''}}/{{referee.attendee.referee.badgeSystem}})
            }
            </div>
          </ng-template>
          <ng-template ng-label-tmp let-referee="item" let-index="index">
            <span [ngClass]="{'notAllocated' : !referee}">
              @if(referee) {
                @if (referee.isPR) {
                  PR: {{referee.team?.name}}
                } @else {
                  {{referee.person.firstName}} {{referee.person.lastName}} (L{{referee.attendee.referee.badge}}{{referee.attendee.referee.upgrade?.badge > 0 ? '*': ''}}/{{referee.attendee.referee.badgeSystem}})
                }
              }
            </span>
          </ng-template>
        </ng-select>
      }

    </div>
</div>`,
  styles: [`
    .teamsCell { padding: 5px; }
    .coaches { height: 30px; border-top: 1px grey solid;}
    .referees { height: 30px; border-top: 1px grey solid;}
    .coachShortName { padding: 5px 10px;}
    .notAllocated { background-color: yellow; }
  `],
})
export class GameRefereeAllocatorComponent {
  gameAttendeeAllocationService = inject(GameAttendeeAllocationService);
  game = input.required<GameView>();
  referees = input<Referee[]>([])
  coaches = input<RefereeCoach[]>([])
  allocation = input.required<RefereeAllocation>();

  gameReferees = [
    signal<Referee|undefined>(undefined),
    signal<Referee|undefined>(undefined),
    signal<Referee|undefined>(undefined)
  ];
  gameCoaches = signal<RefereeCoach[]>([]);
  fullyAllocated = computed(() => {
    return this.gameReferees
      .map(ref => ref() !== undefined)
      .reduce((prev, cur) => prev && cur, true);
  });

  constructor() {
    effect(() => {
      this.game().referees.forEach(gav => {
        if (gav.attendeeAlloc.attendeePosition <3) {
          this.gameReferees[gav.attendeeAlloc.attendeePosition].set(gav.referee);
        }
      });
      this.gameCoaches.set(this.game().coaches.map(r => r.referee!));
    })
  }
  refereeMatchKey(key: string, referee:Referee) {
    const lckeys: string[] = key.toLowerCase().split(' ');
    let res = true;
    for(let i=0; i<lckeys.length && res === true; i++) {
      const lckey = lckeys[i];
      if (referee.isPR) {
        res = referee.team!.name.toLowerCase().indexOf(lckey) >= 0
          || referee.team!.shortName.toLowerCase().indexOf(lckey) >= 0;
      } else {
        res = referee.person!.firstName.toLowerCase().indexOf(lckey) >= 0
          || referee.person!.lastName.toLowerCase().indexOf(lckey) >= 0
          || referee.person!.shortName.toLowerCase().indexOf(lckey) >= 0
          || ('L'+referee.attendee.referee?.badge).toLowerCase().indexOf(lckey) >= 0
          || ('N'+referee.attendee.referee?.badge).toLowerCase().indexOf(lckey) >= 0
          || (lckey.indexOf('*') >=0 && referee.attendee.referee!.upgrade && referee.attendee.referee!.upgrade.badge > 0)
          ;
      }
    }
    // console.log('refereeMatchKey', key, referee, res);
    return res;
  }
  refereeSelected(idx:number, referee: Referee) {
    const rav: GameAttendeeAllocationView|undefined = this.game().referees.find(referee => referee.attendeeAlloc.attendeePosition === idx);
    if (rav) {
      console.log('Update allocation with the selected referee', idx, referee);
      rav.attendeeAlloc.attendeeId = referee.attendee.id;
      rav.referee = referee;
      this.gameReferees[idx].set(rav.referee);
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
        this.gameReferees[idx].set(gav.referee);
      });
    }
  }

  clearReferee(idx: number) {
    const referee = this.gameReferees[idx]();
    this.gameReferees[idx].set(undefined);
    const gav = this.game().referees.find(gav => gav.attendeeAlloc.attendeePosition === idx);
    console.debug('Delete referee allocation', idx, gav);
    if (gav) {
      this.gameAttendeeAllocationService.delete(gav.attendeeAlloc.id);
    }
  }

  coachMatchKey(key: string, coach: RefereeCoach) {
    const lckeys: string[] = key.toLowerCase().split(' ');
    let res = true;
    for(let i=0; i<lckeys.length && res === true; i++) {
      const lckey = lckeys[i];
      res = coach.person!.firstName.toLowerCase().indexOf(lckey) >= 0
        || coach.person!.lastName.toLowerCase().indexOf(lckey) >= 0
        || coach.person!.shortName.toLowerCase().indexOf(lckey) >= 0
        ;
    }
    // console.log('coachMatchKey', key, referee, res);
    return res;
  }
  coachesSelected(event:any) {
    console.debug('coachesSelected', event);
  }
}

