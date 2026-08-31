import { Attendee, colTournament, duplicateTimeslotIds, Team, Tournament } from '@tournament-manager/persistent-data-model';
import { Injectable, signal } from '@angular/core';
import { AbstractPersistentDataService } from './abstract-persistent-data.service';
import { map, Observable, of, tap } from 'rxjs';
import { collection, doc, runTransaction } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class TournamentService extends AbstractPersistentDataService<Tournament>{

  /** Signal containing the current selected tournament. Null means no current tournament is selected. */
  private currentTournament$ = signal<Tournament|null>(null);
  public currentTournament = this.currentTournament$.asReadonly();

  protected override getCollectionName(): string { return colTournament; }

  /** Initializes the display name of legacy parts that predate the `name` field. */
  protected override adjustItemOnLoad(item: Tournament): Tournament {
    item.days?.forEach(day => day.parts?.forEach(part => {
      if (!part.name) part.name = part.id;
    }));
    return item;
  }

  /** Prevents persisting a day whose timeslot identifiers are not unique. */
  override save(item: Tournament): Observable<Tournament> {
    const duplicates = item.days.flatMap(day => duplicateTimeslotIds(day));
    if (duplicates.length > 0) {
      throw new Error(`Duplicate timeslot identifiers: ${duplicates.join(', ')}`);
    }
    return super.save(item).pipe(
      tap(savedTournament => this.setCurrentTournament(savedTournament)),
    );
  }

  /**
   * Atomically creates a tournament and its initial manager attendee.
   * @param tournament tournament document with an empty identifier
   * @param attendee attendee document linked to the tournament
   * @returns both documents after their identifiers have been allocated
   */
  public createWithManager(tournament: Tournament, attendee: Attendee): Observable<{ tournament: Tournament; attendee: Attendee }> {
    const duplicateIds = tournament.days.flatMap(day => duplicateTimeslotIds(day));
    if (duplicateIds.length > 0) {
      throw new Error(`Duplicate timeslot identifiers: ${duplicateIds.join(', ')}`);
    }

    const tournamentRef = doc(collection(this.firestore, this.getCollectionName()));
    const attendeeRef = doc(collection(this.firestore, 'attendee'));
    tournament.id = tournamentRef.id;
    attendee.id = attendeeRef.id;
    attendee.tournamentId = tournament.id;
    tournament.managerAttendeeIds = [attendee.id];
    tournament.lastChange = Date.now();
    attendee.lastChange = Date.now();

    return new Observable(subscriber => {
      runTransaction(this.firestore, async transaction => {
        transaction.set(tournamentRef, tournament);
        transaction.set(attendeeRef, attendee);
      }).then(() => {
        this.setCurrentTournament(tournament);
        subscriber.next({ tournament, attendee });
        subscriber.complete();
      }).catch(error => subscriber.error(error));
    });
  }

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
