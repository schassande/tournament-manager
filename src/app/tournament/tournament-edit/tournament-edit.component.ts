import { UserService } from './../../shared/services/user.service';
import { Country, Division, Person, Region, Timeslot, Tournament } from './../../shared/data.model';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TournamentService } from '../../shared/services/tournament.service';
import { DateService } from 'src/app/shared/services/date.service';
import { RegionService } from 'src/app/shared/services/region.service';
import { map } from 'rxjs';

@Component({
  standalone: false,
  selector: 'app-tournament-edit',
  templateUrl: './tournament-edit.component.html',
  styleUrls: ['./tournament-edit.component.scss'],
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
  tournamentCountry = signal<string>('');
  countries: string[] = [];
  errors = signal<string[]>([]);

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

  countrySelected(countryName: string) {
    this.regionService.all().pipe(
      map((regions:Region[]) => {
        let country: Country|undefined;
        const region: Region|undefined = regions.find(region => {
          country = region.countries.find(country => country.name === countryName);
          return country;
        });
        if (region && country) {
          this.tournament.update(tournament => {
            console.debug('Country selected: ', country, region);
            tournament!.countryId = country!.id;
            tournament!.regionId = region!.id;
            //this.tournamentCountry.set(countryName);
            return tournament;
          });
        }
        this.save();
      })
    ).subscribe()
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

  private save() {
    if (!this.tournament()) return;
    if (!this.checkTournamentBeforeSave(this.tournament()!)) return;
    console.log('Saving tournament');
    const id = this.tournament()!.id;
    this.tournamentService.save(this.tournament()!).subscribe(() => {
      if (id === '') {
        this.router.navigate(['/tournament/' + this.tournament()!.id, 'edit']);
      }
    });
  }

  private init(currentUser: Person) {
    this.countries = this.regionService.countries.map(country => country.name);
    const tournamentId = this.activatedRoute.snapshot.paramMap.get('id') as string;
    if (tournamentId) {
      this.tournamentService.byId(tournamentId).subscribe(t => {
        if (t) {
          this.tournament.set(t);
        } else {
          console.error('Tournament not found: ', tournamentId, t);
          this.router.navigate(['/home']);
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
      const begin = ts[ts.length-1][2]; // end of last timeslot
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
          timeslots: ts.map((t,idx) => { return { id: (idx+1).toString(), start: t[0], duration: t[1], end: t[2]} as Timeslot; }),
          allFieldsAvaillable: true,
          availableFieldIds: []
        }]
      }],
      divisions: [
        {
          id:'100', name: 'Mens Open', shortName: 'MO', teams: [
            {id:'101', divisionName: 'Mens Open', name: 'Team MO 1', shortName: 'MO1'},
            {id:'102', divisionName: 'Mens Open', name: 'Team MO 2', shortName: 'MO2'},
            {id:'103', divisionName: 'Mens Open', name: 'Team MO 3', shortName: 'MO3'},
            {id:'104', divisionName: 'Mens Open', name: 'Team MO 4', shortName: 'MO4'},
          ]
        },
        {
          id:'200', name: 'Womens Open', shortName: 'WO', teams: [
            {id:'201', divisionName: 'Mens Open', name: 'Team WO 1', shortName: 'WO1'},
            {id:'202', divisionName: 'Mens Open', name: 'Team WO 2', shortName: 'WO2'},
            {id:'203', divisionName: 'Mens Open', name: 'Team WO 3', shortName: 'wO3'},
            {id:'204', divisionName: 'Mens Open', name: 'Team WO 4', shortName: 'WO4'},
          ]
        },
        {
          id:'300', name: 'Mixed Open', shortName: 'XO', teams: [
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
