import { Injectable, signal } from '@angular/core';
import { Tournament } from '../data.model';
import { AbstractPersistentDataService } from '../abstract-persistent-data.service';
import { map, Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TournamentService extends AbstractPersistentDataService<Tournament>{

  /** Signal containing the current selected tournament. Null means no current tournament is selected. */
  private currentTournament$ = signal<Tournament|null>(null);

  protected override getCollectionName(): string { return 'tournament'; }

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
}
