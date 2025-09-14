import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { Country, defaultSlotType, Division, Person, Tournament } from '@tournament-manager/persistent-data-model';
import { UserService } from '../service/user.service';
import { TournamentService } from '../service/tournament.service';
import { DateService } from '../service/date.service';
import { RegionService } from '../service/region.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TournamentFieldsEditComponent } from '../component/tournament-fields-edit.component';
import { TournamentDaysEditComponent } from '../component/tournament-days-edit.component';
import { SelectModule } from 'primeng/select';
import { MessageModule } from 'primeng/message';
import { TournamentDivisionsEditComponent } from '../component/tournament-divisions-edit.component';
import { TextareaModule } from 'primeng/textarea';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  selector: 'app-tournament-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, MessageModule, SelectModule, TextareaModule,
    TournamentFieldsEditComponent, TournamentDaysEditComponent, TournamentDivisionsEditComponent],
  template: `
  @if (tournament()) {
  <div class="page">

    <div style="margin: 20px; text-align: center;">
      @for(error of errors(); track error) {
        <p-message severity="error">{{ error }}</p-message>
      }
    </div>

    <h2>General information</h2>
    <div class="chapterSection">
      <div class="form-field">
        <label for="name">Name</label>
        <input id="name" type="text" pInputText [(ngModel)]="tournament()!.name" required />
      </div>
      <div class="form-field">
        <label for="description">Description</label>
        <textarea id="description" pInputTextarea [(ngModel)]="tournament()!.description"></textarea>
      </div>
      <div class="form-field">
        <label for="country">Country</label>
        <p-select id="description" size="small" [options]="countries" [(ngModel)]="country"
          optionLabel="name" [filter]="true" filterBy="name"
          appendTo="body" placeholder="Country" (onChange)="countrySelected()" />
        </div>
    </div>

    <h2>Tournament fields</h2>
    <div class="chapterSection">
      <app-tournament-fields-edit
        [(fields)]="tournament()!.fields">
      </app-tournament-fields-edit>
    </div>

    <h2>Tournament days</h2>
    <div class="chapterSection">
      <app-tournament-days-edit
        [tournament]="tournament()!"
        (dayChange)="onDayChange()"
        (startDateChange)="onTournamentStartDateChange($event)"
        (endDateChange)="onTournamentEndDateChange($event)">
      </app-tournament-days-edit>
    </div>

    <h2>Divisions and teams</h2>
    <div class="chapterSection">
      <app-tournament-divisions-edit
        [tournament]="tournament()!" (divisionsChanged)="onDivisionsChanged($event)" >
      </app-tournament-divisions-edit>
    </div>
    <div style="height: 100px;"></div>
  </div>
  }
  `,
  styles: [`
    .page {
      margin: 0 auto;
    }

    .chapterSection .form-field {
      margin: 5px 0;
      vertical-align: middle;
    }
    .chapterSection .form-field label {
      display: inline-block;
      width: 150px;
      text-align: right;
      margin-right: 10px;
      vertical-align: top;
    }

    .chapterSection .form-field textarea {
      width: 450px;
      height: 60px;
    }
  `],
})
export class TournamentEditComponent  implements OnInit {
  // Services
  private activatedRoute = inject(ActivatedRoute);
  private tournamentService = inject(TournamentService);
  private router = inject(Router);
  private userService = inject(UserService);
  private dateService = inject(DateService);
  private regionService = inject(RegionService);

  // Properties
  tournament = signal<Tournament|null>(null);
  country: Country|undefined;
  countries: Country[] = this.regionService.countries;
  errors = signal<string[]>([]);
  constructor() {
    effect(() => {
      const tournament = this.tournament();
      if (tournament) {
        this.country = this.regionService.countryById(tournament.countryId);
      }
    });
  }
  ngOnInit() {
    this.userService.currentUser$$.subscribe((currentUser) => {
      if (currentUser) this.init(currentUser);
    });
  }

  onDivisionsChanged(divisions: Division[]) {
    this.tournament.update(tournament => {
      tournament!.divisions = divisions;
      this.save();
      return tournament;
    });
  }

  countrySelected() {
    this.tournament.update(tournament => {
      if (!tournament || !this.country) return tournament;
      const region = this.regionService.regionByCountryId(this.country.id);
      if (!region) {
        console.error('Region not found for country: ', tournament.countryId);
        return tournament;
      }
      tournament.countryId = this.country.id;
      tournament.regionId = region.id;
      console.log('Country selected: ', this.country.name + '/'+ region.name);
      this.save();
      return tournament
    });
  }

  onTournamentStartDateChange(startDate: number) {
    this.tournament.update(tournament => {
      tournament!.startDate = startDate;
      this.save();
      return tournament;
    });
  }
  onTournamentEndDateChange(endDate: number) {
    this.tournament.update(tournament => {
      tournament!.endDate = endDate;
      this.save();
      return tournament;
    });
  }

  onDayChange() {
    this.tournament.update(tournament => {
      this.save();
      return tournament;
    });
  }

  private save() {
    if (!this.tournament()) return;
    if (!this.checkTournamentBeforeSave(this.tournament()!)) return;
    const id = this.tournament()!.id;
    console.debug('Saving tournament: ', this.tournament());
    this.tournamentService.save(this.tournament()!).subscribe({
      next: (t) => {
        this.tournament.set(t);
        if (id === '') {
          this.router.navigate([`/tournament/${t.id}/edit`]);
        }
      },
      error: (err) => {
        console.error('Error saving tournament: ', err, this.tournament());
      }
    });
  }

  private init(currentUser: Person) {
    const tournamentId = this.activatedRoute.snapshot.paramMap.get('tournamentId') as string;
    if (tournamentId) {
      this.tournamentService.byId(tournamentId).subscribe(t => {
        if (t) {
          t.id = tournamentId;
          this.tournament.set(t);
        } else {
          console.error('Tournament not found: ', tournamentId, t);
          this.router.navigate(['/tournament']);
        }
      });
    } else {
      this.tournament.set(this.buildDefaultTournament(currentUser));
    }
  }


  // ================================================ //
  // =============== INTERNAL METHODS =============== //
  // ================================================ //

  private checkTournamentBeforeSave(tournament: Tournament): boolean {
    this.errors.update(() => {
      const errors = [];
      if (!tournament.name || tournament.name.length <4) errors.push('Tournament name is too short (4 characters minimum)');
      if (!tournament.regionId) errors.push('Tournament region is not defined');
      if (tournament.managers.length === 0) errors.push('Tournament managers are not defined');
      if (!tournament.countryId) errors.push('Tournament country is not defined');
      if (tournament.divisions.length === 0) errors.push('At least one tournament division is required');
      if (tournament.fields.length === 0) errors.push('At least one tournament field is required');
      if (tournament.days.length === 0) errors.push('At least one tournament day is required');
      if (tournament.startDate <= 0) errors.push('Tournament start date is is not defined');
      return errors;
    });
    return this.errors().length === 0;
  }

  private buildDefaultTournament(currentUser: Person): Tournament {
    const startDateEpoch = this.dateService.setTime(this.dateService.tomorrow(), 9, 0);
    const defaultDuration = 50*60*1000;
    const ts =  [[startDateEpoch, defaultDuration, this.dateService.addMilli(startDateEpoch, defaultDuration)]];
    for(let i=0; i<4; i++) {
      const begin:number = ts[ts.length-1][2]; // end of last timeslot
      ts.push([begin, defaultDuration, this.dateService.addMilli(begin, defaultDuration)]);
    }
    const nowEpoch = new Date().getTime();
    return {
      id: '',
      lastChange: nowEpoch,
      name: 'test',
      description: '',
      startDate: startDateEpoch,
      endDate: startDateEpoch,
      nbDay: 1,
      timeZone: 'UTC+01:00',
      venue: '',
      city: '',
      countryId: '',
      regionId: '',
      fields: [
        { id: '1', name: 'Field 1', video: false, quality: 1, orderView: 1 },
        { id: '2', name: 'Field 2', video: false, quality: 1, orderView: 2 }
      ],
      days: [{
        id: '1',
        date: startDateEpoch,
        parts: [{
          id: '1',
          dayId: '1',
          timeslots: ts.map((t,idx) => { return {
            id: (idx+1).toString(),
            start: t[0],
            duration: t[1],
            end: t[2],
            slotType: defaultSlotType,
            playingSlot: true
          }  }),
          allFieldsAvaillable: true,
          availableFieldIds: []
        }]
      }],
      divisions: [
        {
          id:'100', name: 'Mens Open', shortName: 'MO', backgroundColor: 'blue', fontColor: 'white', teams: [
            {id:'101', divisionName: 'Mens Open', name: 'Team MO 1', shortName: 'MO1'},
            {id:'102', divisionName: 'Mens Open', name: 'Team MO 2', shortName: 'MO2'},
            {id:'103', divisionName: 'Mens Open', name: 'Team MO 3', shortName: 'MO3'},
            {id:'104', divisionName: 'Mens Open', name: 'Team MO 4', shortName: 'MO4'},
          ]
        },
        {
          id:'200', name: 'Womens Open', shortName: 'WO', backgroundColor: 'pink', fontColor: 'black', teams: [
            {id:'201', divisionName: 'Mens Open', name: 'Team WO 1', shortName: 'WO1'},
            {id:'202', divisionName: 'Mens Open', name: 'Team WO 2', shortName: 'WO2'},
            {id:'203', divisionName: 'Mens Open', name: 'Team WO 3', shortName: 'wO3'},
            {id:'204', divisionName: 'Mens Open', name: 'Team WO 4', shortName: 'WO4'},
          ]
        },
        {
          id:'300', name: 'Mixed Open', shortName: 'XO', backgroundColor: 'yellow', fontColor: 'black', teams: [
            {id:'301', divisionName: 'Mixed Open', name: 'Team XO 1', shortName: 'XO1'},
            {id:'302', divisionName: 'Mixed Open', name: 'Team XO 2', shortName: 'XO2'},
            {id:'303', divisionName: 'Mixed Open', name: 'Team XO 3', shortName: 'xO3'},
            {id:'304', divisionName: 'Mixed Open', name: 'Team xO 4', shortName: 'XO4'},
          ]
        }
      ],
      managers :[{ role: 'TournamentManager', attendeeId: currentUser.id }],
    };
  }
}
