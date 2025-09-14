import { colTournament, Team, Tournament } from '@tournament-manager/persistent-data-model';
import { Injectable, signal } from '@angular/core';
import { AbstractPersistentDataService } from './abstract-persistent-data.service';
import { map, Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TournamentService extends AbstractPersistentDataService<Tournament>{

  /** Signal containing the current selected tournament. Null means no current tournament is selected. */
  private currentTournament$ = signal<Tournament|null>(null);
  public currentTournament = this.currentTournament$.asReadonly();

  protected override getCollectionName(): string { return colTournament; }

  public loadCurrentTournamentFromLocalStorage(): Observable<Tournament|undefined> {
    const tournamentId = localStorage.getItem('currentTournamentId');
    if (!tournamentId) return of(undefined);
    return this.byId(tournamentId).pipe(map(t => {
      if (t) {
        this.setCurrentTournament(t);
      } else {
        console.warn('No tournament found in local storage: ', tournamentId);
        localStorage.removeItem('currentTournamentId');
      }
      return t;
    }));
  }

  public setCurrentTournament(tournament: Tournament|null) {
    this.currentTournament$.set(tournament);
    // store the current tournament in local storage
    if (tournament) {
      localStorage.setItem('currentTournamentId', tournament.id);
    }
    else {
      localStorage.removeItem('currentTournamentId');
    }
  }
  public getCurrentTournament(): Tournament|null {
    return this.currentTournament$();
  }

  public getTeam(tournament: Tournament, teamId: string) {
    let res: Team|undefined;
    tournament.divisions.find(division => res = division.teams.find(team => team.id === teamId));
    return res;
  }
}
