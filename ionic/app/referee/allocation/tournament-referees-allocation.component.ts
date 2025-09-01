import { AttendeeService } from 'src/app/shared/services/attendee.service';
import { Component, effect, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, map, mergeMap, Observable, of, take } from 'rxjs';
import { Attendee, Day, Division, Field, Game, GameAttendeeAllocation, PartDay, Person, Referee, RefereeAllocation, RefereeCoach, Team, Timeslot } from 'src/app/shared/data.model';
import { DateService } from 'src/app/shared/services/date.service';
import { GameAttendeeAllocationService } from 'src/app/shared/services/game-attendee-allocation.service';
import { GameService } from 'src/app/shared/services/game.service';
import { RefereeAllocationService } from 'src/app/shared/services/referee-allocation.service';
import { AbstractTournamentComponent } from 'src/app/shared/tournament-abstract.service';
import { PersonService } from 'src/app/shared/services/person.service';
import { RefereeService } from 'src/app/shared/services/referee.service';
import { DayView, FieldView, GameAttendeeAllocationView, GameView, PartView, TimeSlotView } from './allocation-data-model';

@Component({
  selector: 'app-tournament-referees-allocation',
  template: `
  <div *ngIf="day()">
    <h2>Allocation of the referees and referees coaches on day {{day()?.label}} {{ allocation()?.name }}</h2>
    <div class="chapterSection">
      <div>{{referees().length}} referees and {{coaches().length}} referee coaches.</div>
      @for(part of day()!.partViews; track part.id) {
        <h3>Part {{ part.id }}</h3>
        <table>
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
                  <td [ngClass]="{ 'noGameCell': !field.game,  'gameCell': field.game}" class="fieldCol" >
                    @if (field.game) {
                      <app-game-referee-allocator [game]="field.game" [coaches]="coaches()" [referees]="referees()" [allocation]="allocation()!"></app-game-referee-allocator>
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
    </div>
  `,
  styles: [`
    .fieldCol { width: 200px;}
    .noGameCell { background-color: #eeeeee; }
    .gameCell { background-color: #ffffff; height: 170px;  vertical-align: top;}
    .tableRowItem .timeslotCell { font-weight: bold; }
    .tableRowTitle th, .tableRowItem td {
      text-align: center;
      border: 2px grey solid;
    }
    .tableRowTitle th, .timeslotCell {
      padding: 10px 5px;
    }
    `],
  standalone: false
})
export class TournamentRefereesAllocationComponent extends AbstractTournamentComponent  {

  private activatedRoute = inject(ActivatedRoute);
  private refereeService = inject(RefereeService);
  private dateService = inject(DateService);
  private gameService = inject(GameService);
  private gameAttendeeAllocationService = inject(GameAttendeeAllocationService);
  private refereeAllocationService = inject(RefereeAllocationService);

  day = signal<DayView|undefined>(undefined);
  allocation = signal<RefereeAllocation|undefined>(undefined);
  referees = signal<Referee[]>([])
  coaches = signal<RefereeCoach[]>([])

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

  private loadAttendees(): Observable<any> {
    // console.debug('loadAttendees');
    return forkJoin([
      of(''),
      this.refereeService.findReferees(this.tournament()!).pipe(
        map(referees => this.referees.set(referees)),
        take(1)
      ),
      this.refereeService.findRefereeCoaches(this.tournament()!.id).pipe(
        map(coaches => this.coaches.set(coaches)),
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
                  const referee: Referee|undefined = this.referees().find(r => r.attendee.id === gav.attendeeAlloc.attendeeId);
                  if (referee) {
                    console.log('gameAllocations', gv.game.id, gameAllocations, 'referee', referee);
                    gav.referee = referee;
                    gv.referees.push(gav);
                    gv.referees.sort((a1,a2) => a1.attendeeAlloc.attendeePosition - a2.attendeeAlloc.attendeePosition)
                  }
                } else if (gav.attendeeAlloc.attendeeRole === 'Coach') {
                  const coach: RefereeCoach|undefined = this.coaches().find(c => c.attendee.id === gav.attendeeAlloc.attendeeId);
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
}
