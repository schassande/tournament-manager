import { UserService } from './../../shared/services/user.service';
import { Day, Field, PartDay, Person, Timeslot, Tournament } from './../../shared/data.model';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TournamentService } from '../../shared/services/tournament.service';
import { DateService } from 'src/app/shared/services/date.service';

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

  // Properties
  tournament = signal<Tournament|null>(null);

  ngOnInit() {
    this.userService.currentUser$$.subscribe((currentUser) => {
      if (currentUser) this.init(currentUser);
    });
  }

  private init(currentUser: Person) {
    const tournamentId = this.activatedRoute.snapshot.paramMap.get('id') as string;
    if (tournamentId) {
      this.tournamentService.byId(tournamentId).subscribe(t => {
        if (t) {
          this.tournament.set(t);
        } else {
          this.router.navigate(['/home']);
        }
      });
    } else {
      this.tournament.set(this.buildDefaultTournament(currentUser));
    }
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
          id:'1', name: 'Mens Open', shortName: 'MO', teams: [
            {id:'101', divisionName: 'Mens Open', name: 'Team MO 1', shortName: 'MO1'},
            {id:'102', divisionName: 'Mens Open', name: 'Team MO 2', shortName: 'MO2'},
            {id:'103', divisionName: 'Mens Open', name: 'Team MO 3', shortName: 'MO3'},
            {id:'104', divisionName: 'Mens Open', name: 'Team MO 4', shortName: 'MO4'},
          ]
        },
        {
          id:'2', name: 'Womens Open', shortName: 'WO', teams: [
            {id:'201', divisionName: 'Mens Open', name: 'Team WO 1', shortName: 'WO1'},
            {id:'202', divisionName: 'Mens Open', name: 'Team WO 2', shortName: 'WO2'},
            {id:'203', divisionName: 'Mens Open', name: 'Team WO 3', shortName: 'wO3'},
            {id:'204', divisionName: 'Mens Open', name: 'Team WO 4', shortName: 'WO4'},
          ]
        },
        {
          id:'3', name: 'Mixed Open', shortName: 'XO', teams: [
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

  onTournamentStartDateChange(startDate: number) {
    this.tournament.update(tournament => {
      tournament!.startDate = startDate;
      return tournament;
    });
  }
  onTournamentEndDateChange(endDate: number) {
    this.tournament.update(tournament => {
      tournament!.endDate = endDate;
      return tournament;
    });
  }

  public save() {
    if (this.tournament()) {
      this.tournamentService.save(this.tournament()!).subscribe(() => {
        this.router.navigate(['/tournament/' + this.tournament()!.id]);
      });
    }
  }
}
