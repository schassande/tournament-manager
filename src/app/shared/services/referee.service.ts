import { inject, Injectable } from '@angular/core';
import { Referee, RefereeCoach, Tournament } from '../data.model';
import { forkJoin, map, mergeMap, Observable, of, take } from 'rxjs';
import { AttendeeService } from './attendee.service';
import { PersonService } from './person.service';
import { TournamentService } from './tournament.service';

@Injectable({
  providedIn: 'root'
})
export class RefereeService {
  private attendeeService = inject(AttendeeService);
  private personService = inject(PersonService);
  private tournamentService = inject(TournamentService);

  public findReferees(tournament: Tournament): Observable<Referee[]> {
    return this.attendeeService.findTournamentReferees(tournament.id).pipe(
      mergeMap(attendees => {
        const obs: Observable<any>[] = [of('')]
        const referees: Referee[] = attendees.map(attendee => {
          // console.debug('Referee attendee loaded', attendee);
          const referee: Referee = { attendee, person: undefined, isPR: attendee.isReferee && attendee.isPlayer };
          if (attendee.personId) {
            obs.push(this.personService.byId(attendee.personId).pipe(
              map(person => {
                // console.debug('Referee person loaded', person);
                referee.person = person
              }),
              take(1)
            ));
          }
          if (attendee.isPlayer) {
            referee.team = this.tournamentService.getTeam(tournament, attendee.player!.teamId);
          }
          return referee;
        });
        return forkJoin(obs).pipe(map(() => referees))
      })
    )
  }
  public findRefereeCoaches(tournamentId: string): Observable<RefereeCoach[]> {
    return this.attendeeService.findTournamentRefereeCoaches(tournamentId).pipe(
      mergeMap(attendees => {
        const obs: Observable<any>[] = [of('')];
        const coaches: RefereeCoach[] = attendees.map(attendee => {
          // console.debug('RefereeCoach attendee loaded', attendee);
          const refereeCoach: RefereeCoach = { attendee, person: undefined };
          if (attendee.personId) {
            obs.push(this.personService.byId(attendee.personId).pipe(
              map(person => {
                // console.debug('RefereeCoach person loaded', person);
                refereeCoach.person = person;
              }),
              take(1)
            ));
          }
          return refereeCoach;
        });
        return forkJoin(obs).pipe(map(() => coaches))
      })
    )
  }
}
