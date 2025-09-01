import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { map } from 'rxjs';
import { Day, Division, Game, PartDay, Field, Team, Timeslot } from '../data.model';
import { AbstractTournamentPage } from '../component/tournament-abstract.page';
import { DateService } from '../service/date.service';
import { GameService } from '../service/game.service';
import { SelectButtonModule } from 'primeng/selectbutton';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-tournament-games',
  imports: [ ButtonModule, CommonModule, FormsModule, SelectButtonModule, SelectModule, TableModule],
  template: `
    <div>
    <p-selectbutton [options]="days" [(ngModel)]="selectedDay" optionLabel="label" optionValue="value" (ngModelChange)="selectedDayChanged()"/>
    <div class="chapterSection">
      @for(part of parts(); track part.part.id) {
        <div>Part {{part.part.id}}</div>
        <p-table [value]="part.games" showGridlines [size]="'small'" tableLayout="fixed">
          <ng-template #header>
              <tr class="tableRowTitle">
                <th style="width:10%">Time slot</th>
                <th style="width:10%">Field</th>
                <th style="width:10%" *ngIf="showDivision()">Division</th>
                <th style="width:20%">What</th>
                <th style="width:20%">Team A</th>
                <th style="width:20%">Team B</th>
                <th style="width:10%">Action</th>
              </tr>
          </ng-template>
          <ng-template #body let-game let-ri="rowIndex">
            <tr class="tableRowItem  tableRowItem-{{game.timeslot!.id % 2}}">
              <td [pEditableColumn]="game.timeSlot" pEditableColumnField="timeslot" style="text-align: center;">
                <p-cellEditor>
                  <ng-template #input>
                    <p-select id="timeslot" size="small" [options]="part.playingTimeSlots"
                      [(ngModel)]="game.timeSlot" optionLabel="name" optionValue="id"
                      appendTo="body" placeholder="time slot" (onChange)="timeSlotSelected(part, game, $event.value)">
                      <ng-template let-timeslot #item #selectedItem >
                        <div class="flex items-center gap-2">
                            <div>{{ timeslot.startStr }}</div>
                        </div>
                      </ng-template>
                    </p-select>
                  </ng-template>
                  <ng-template #output>{{ game.timeslotStr }}</ng-template>
                </p-cellEditor>
              </td>
              <td [pEditableColumn]="game.field" pEditableColumnField="field" style="text-align: center;">
                <p-cellEditor>
                  <ng-template #input>
                    <p-select id="field" size="small" [options]="part.fields"
                      [(ngModel)]="game.field" optionLabel="name" optionValue="id"
                      appendTo="body" placeholder="Field" (onChange)="fieldSelected(part, game, $event.value)">
                      <ng-template let-field #item #selectedItem >
                        <div class="flex items-center gap-2">
                            <div>{{ field.name }}</div>
                        </div>
                      </ng-template>
                    </p-select>
                  </ng-template>
                  <ng-template #output>{{ game.field.name }}</ng-template>
                </p-cellEditor>
              </td>
              <td [pEditableColumn]="game.division" pEditableColumnField="division" style="text-align: center;" *ngIf="showDivision()">
                <p-cellEditor>
                  <ng-template #input>
                    <p-select id="division" size="small" [options]="tournament()!.divisions"
                      [(ngModel)]="game.division" optionLabel="name" optionValue="id"
                      appendTo="body" placeholder="Division" (onChange)="divisionSelected(game, $event.value)">
                      <ng-template let-division #item #selectedItem >
                        <div class="flex items-center gap-2">
                            <div>{{ division.shortName }}</div>
                        </div>
                      </ng-template>
                    </p-select>
                  </ng-template>
                  <ng-template #output>{{ game.division.shortName }}</ng-template>
                </p-cellEditor>
              </td>

              <td [pEditableColumn]="game.what" pEditableColumnField="what" style="text-align: center;">
                <p-cellEditor>
                  <ng-template #input><input pInputText type="text" [(ngModel)]="game.game.what" (blur)="gameWhatChanged(game)"/></ng-template>
                  <ng-template #output>{{ game.game.what }}</ng-template>
                </p-cellEditor>
              </td>

              <td [pEditableColumn]="game.homeTeam" pEditableColumnField="homeTeam" style="text-align: center;">
                <p-cellEditor>
                  <ng-template #input>
                    <p-select id="homeTeam" size="small" [options]="game.division!.teams"
                      [(ngModel)]="game.homeTeam" optionLabel="name" optionValue="id"
                      appendTo="body" placeholder="Team" (onChange)="teamSelected(game, true, $event.value)">
                      <ng-template let-team #item #selectedItem >
                        <div class="flex items-center gap-2">
                            <div>{{ team.shortName }}</div>
                        </div>
                      </ng-template>
                    </p-select>
                  </ng-template>
                  <ng-template #output>{{ game.homeTeam?.shortName }}</ng-template>
                </p-cellEditor>
              </td>
              <td [pEditableColumn]="game.awayTeam" pEditableColumnField="awayTeam" style="text-align: center;">
                <p-cellEditor>
                  <ng-template #input>
                    <p-select id="awayTeam" size="small" [options]="game.division!.teams"
                      [(ngModel)]="game.awayTeam" optionLabel="name" optionValue="id"
                      appendTo="body" placeholder="Team" (onChange)="teamSelected(game, false, $event.value)">
                      <ng-template let-team #item #selectedItem >
                        <div class="flex items-center gap-2">
                            <div>{{ team.shortName }}</div>
                        </div>
                      </ng-template>
                    </p-select>
                  </ng-template>
                  <ng-template #output>{{ game.awayTeam?.shortName }}</ng-template>
                </p-cellEditor>
              </td>
              <td style="text-align: center;">
                <i class="pi pi-trash action action-remove" aria-label="remove referee" (click)="removeGame(game)"></i>
              </td>
            </tr>
          </ng-template>
        </p-table>
        <div class="buttonPanel">
        <p-button (click)="addGame(part)" icon="pi pi-add" label="Add a game"></p-button>
      </div>
    }
    </div>
    </div>
    `,
  styles: [`
    .tableRowTitle th { text-align: center;}
    .tableRowItem-0 { }
    .tableRowItem-1 { background-color: #eeeeee;}
    .action { font-size: 1.3rem}
    .action-remove { margin-right: 10px; color: red;}
    .action-edit { margin-right: 10px; color: blue;}
    .buttonPanel { text-align: right; margin: 10px 0;}
    .table-buttons { margin: 0 10px;}
    `],
  standalone: true
})
export class TournamentGamesComponent  extends AbstractTournamentPage  {

  private dateService = inject(DateService);
  private gameService = inject(GameService);

  days: DayView[] = [];
  selectedDay: DayView|undefined;
  parts = signal<PartView[]>([]);
  showDivision = signal<boolean>(true);

  constructor() {
    super();
    effect(() => {
      if (this.tournament()) {
        this.showDivision.set(this.tournament()!.divisions.length > 1);
        this.days = this.tournament()!.days.map((day: Day) => {
          return { label: this.dateService.toDate(day.date), value: day };
        });
        this.selectedDay = this.days[0];
        this.selectedDayChanged();
        console.log('effect', this.days, this.selectedDay);
      }
    });
  }
  selectedDayChanged() {
    console.log('selectedDayChanged', this.selectedDay);
    this.loadGames();
  }
  private loadGames() {
    this.gameService.byDay(this.tournament()!.id, this.selectedDay!.value.id).pipe(
      map((games: Game[]) => {
        // console.log('games', games);
        this.parts.set(this.selectedDay!.value.parts.map((part: PartDay) => {
          const playingTimeSlots: TimeSlotView[] = part.timeslots
            .filter((ts: Timeslot) => ts.playingSlot)
            .map((ts: Timeslot) => {
              return { ...ts, startStr: this.dateService.toTime(ts.start), endStr: this.dateService.toTime(ts.end) };
            });
          const gvs: GameView[] = games.filter((game: Game) => game.partDayId === part.id).map((game: Game) => {
            const division = this.tournament()!.divisions.find((division: Division) => division.id === game.divisionId);
            const homeTeam = division ? division!.teams.find((team: Team) => team.id === game.homeTeamId) : undefined;
            const awayTeam = division ? division!.teams.find((team: Team) => team.id === game.awayTeamId) : undefined;
            const timeslot = playingTimeSlots.find(ts => ts.id === game.timeslotId);
            return {game, division, timeslot,
              timeslotStr: timeslot ? this.dateService.toTime(timeslot.start) : '',
              field: this.tournament()!.fields.find((field: Field) => field.id === game.fieldId),
              homeTeam,
              awayTeam
            };
          });
          const fields: Field[] = []
          if (part.allFieldsAvaillable) {
            fields.push(...this.tournament()!.fields);
          } else {
            part.availableFieldIds.forEach((fieldId: string) => {
              const f = this.tournament()!.fields.find((field: Field) => field.id === fieldId);
              if (f) fields.push(f);
            });
          }
          this.sortGames(gvs);
          return { part, games: gvs, fields, playingTimeSlots };
        }));
      })
    ).subscribe();
  }
  private sortGames(gvs: GameView[]) {
    gvs.sort((a: GameView, b: GameView) => {
      if (!a.timeslot) console.log(a);
      if (!b.timeslot) console.log(b);
      let res = a.timeslot!.start - b.timeslot!.start;
      return res === 0 ? a.field!.orderView - b.field!.orderView : res;
    });
  }
  addGame(pv:PartView) {
    console.log('addGame', this.selectedDay);
    const gv: GameView = {
      timeslotStr: '',
      game : {
        id: '',
        lastChange: new Date().getTime(),
        tournamentId: this.tournament()!.id,
        dayId: this.selectedDay!.value.id,
        partDayId: pv.part.id,
        timeslotId: '',
        fieldId: '',
        divisionId: '',
        homeTeamId: '',
        awayTeamId: '',
        scheduleId: ''
      }
    };

    // use the first division in the list
    gv.division = this.tournament()!.divisions[0];
    gv.game.divisionId = gv.division.id;

    if (pv.games.length > 0) {
      const lastGV = pv.games[pv.games.length-1];
      // use the timeslot of the last game in the list
      console.debug('use the timeslot of the last game in the list');
      gv.game.timeslotId = lastGV.game.timeslotId;
      gv.timeslot = lastGV.timeslot;
      gv.timeslotStr = lastGV.timeslotStr;

      // take the next field in the list
      if (lastGV.field) {
        const fieldIndex = pv.fields.findIndex((field: Field) => field.id === lastGV.game.fieldId);
        if (0 <= fieldIndex && fieldIndex < pv.fields.length - 1) {
          // use the next field in the list
          console.debug('use the next field in the list');
          gv.game.fieldId = pv.fields[fieldIndex + 1].id;
          gv.field = pv.fields[fieldIndex + 1];
        } else {
          // no more field, try to use the next timeslot and the first field
          const timeslotIndex = pv.playingTimeSlots.findIndex((ts: Timeslot) => ts.id === lastGV.game.timeslotId);
          if (0 <= timeslotIndex && timeslotIndex < pv.playingTimeSlots.length - 1) {
            console.debug('use the next timeslot and the first field', timeslotIndex + 1);
            gv.game.timeslotId = pv.playingTimeSlots[timeslotIndex + 1].id;
            gv.timeslot = pv.playingTimeSlots[timeslotIndex + 1];
            gv.timeslotStr = this.dateService.toTime(gv.timeslot.start);
          } else {
            console.debug('No more timeslot');
          }
        }
      } else {
        console.debug('No field on previous slot');
      }
    } else {
      console.debug('use the first timeslot and field in the list');
      // use the first timeslot and field in the list
      gv.game.timeslotId = pv.playingTimeSlots[0].id;
      gv.timeslot = pv.playingTimeSlots[0];
      gv.timeslotStr = this.dateService.toTime(gv.timeslot.start);
    }
    if (!gv.field) {
      // use the first field in the list if not already defined
      gv.game.fieldId = pv.fields[0].id;
      gv.field = pv.fields[0];
    }
    this.parts.update((parts) => {
      const part = parts.find((p) => p.part.id === pv.part.id);
      if (part) {
        part.games.push(gv);
        console.log('game', gv);
        this.gameService.save(gv.game).subscribe();
      }
      return parts;
    });
    this.partsChanged();
  }
  removeGame(gv:GameView) {
    this.gameService.delete(gv.game.id);
    this.parts.update((parts) => {
      const part = parts.find((p) => p.part.id === gv.game.partDayId);
      if (part) {
        part.games = part.games.filter((g) => g.game.id !== gv.game.id);
      }
      return parts;
    });
    this.partsChanged();
  }
  private partsChanged() {
    this.parts.update(parts => {
      setTimeout(() => this.parts.set(parts), 100);
      return [];
    });
  }
  timeSlotSelected(part: PartView, gv: GameView, timeslotId: string) {
    gv.game.timeslotId = timeslotId;
    gv.timeslot = part.playingTimeSlots.find((ts: Timeslot) => ts.id === timeslotId);
    gv.timeslotStr = this.dateService.toTime(gv.timeslot!.start);
    this.sortGames(part.games);
    this.gameService.save(gv.game).subscribe();
    this.partsChanged();
  }
  fieldSelected(part: PartView, gv: GameView, fieldId: string) {
    gv.game.fieldId = fieldId;
    gv.field = part.fields.find((field: Field) => field.id === fieldId);
    this.gameService.save(gv.game).subscribe();
    this.partsChanged();
  }
  divisionSelected(gv: GameView, divisionId: string) {
    gv.game.divisionId = divisionId;
    gv.division = this.tournament()!.divisions.find((division: Division) => division.id === divisionId);

    gv.homeTeam = gv.division!.teams[0];
    gv.game.homeTeamId = gv.homeTeam.id;

    gv.awayTeam = gv.division!.teams[1];
    gv.game.awayTeamId = gv.awayTeam.id;

    this.gameService.save(gv.game).subscribe();
    this.partsChanged();
  }
  gameWhatChanged(gv: GameView) {
    this.gameService.save(gv.game).subscribe();
    this.partsChanged();
  }
  teamSelected(gv: GameView, isHome: boolean, teamId: string) {
    if (isHome) {
      gv.game.homeTeamId = teamId;
      gv.homeTeam = gv.division!.teams.find((team: Team) => team.id === teamId);
    } else {
      gv.game.awayTeamId = teamId;
      gv.awayTeam = gv.division!.teams.find((team: Team) => team.id === teamId);
    }
    this.gameService.save(gv.game).subscribe();
    this.partsChanged();
  }
}

interface DayView {
  label: string;
  value: Day;
}
interface TimeSlotView extends Timeslot {
  startStr: string;
  endStr: string;
}
interface PartView {
  part: PartDay;
  games: GameView[];
  playingTimeSlots: TimeSlotView[];
  fields: Field[];
}
interface GameView {
  game: Game;
  division?: Division;
  timeslot?: Timeslot;
  timeslotStr: string;
  field?: Field;
  homeTeam?: Team;
  awayTeam?: Team;
}
