import { Functions, httpsCallable } from '@angular/fire/functions';
import {
  Attendee,
  colTournament,
  duplicateTimeslotIds,
  Team,
  Tournament,
} from '@tournament-manager/persistent-data-model';
import { inject, Injectable, signal } from '@angular/core';
import { AbstractPersistentDataService } from './abstract-persistent-data.service';
import { from, map, Observable, of, tap } from 'rxjs';
import { orderBy, query as firestoreQuery, where } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root',
})
export class TournamentService extends AbstractPersistentDataService<Tournament> {
  private readonly functions = inject(Functions);

  /** Signal containing the current selected tournament. Null means no current tournament is selected. */
  private currentTournament$ = signal<Tournament | null>(null);
  public currentTournament = this.currentTournament$.asReadonly();

  /** Returns the persisted collection used by inherited read operations. */
  protected override getCollectionName(): string {
    return colTournament;
  }

  /** Initializes the display name of legacy parts that predate the `name` field. */
  protected override adjustItemOnLoad(item: Tournament): Tournament {
    item.days?.forEach((day) =>
      day.parts?.forEach((part) => {
        if (!part.name) part.name = part.id;
      }),
    );
    return item;
  }

  /**
   * Loads tournaments whose start date is within the requested range.
   * @param startDateInclusive lower Unix timestamp bound, included in the result
   * @param endDateExclusive upper Unix timestamp bound, excluded from the result
   * @returns tournaments ordered by start date
   */
  public byStartDateRange(startDateInclusive: number, endDateExclusive: number): Observable<Tournament[]> {
    return this.query(
      firestoreQuery(
        this.itemsCollection(),
        where('startDate', '>=', startDateInclusive),
        where('startDate', '<', endDateExclusive),
        orderBy('startDate'),
      ),
    );
  }

  /** Prevents persisting a day whose timeslot identifiers are not unique. */
  override save(item: Tournament): Observable<Tournament> {
    const duplicates = item.days.flatMap((day) => duplicateTimeslotIds(day));
    if (duplicates.length > 0) {
      throw new Error(`Duplicate timeslot identifiers: ${duplicates.join(', ')}`);
    }
    return super.save(item).pipe(tap((savedTournament) => this.setCurrentTournament(savedTournament)));
  }

  /**
   * Atomically creates a tournament and its initial manager attendee.
   * @param tournament tournament document with an empty identifier
   * @param attendee attendee document linked to the tournament
   * @returns both documents after their identifiers have been allocated
   */
  public createWithManager(
    tournament: Tournament,
    attendee: Attendee,
  ): Observable<{ tournament: Tournament; attendee: Attendee }> {
    const duplicateIds = tournament.days.flatMap((day) => duplicateTimeslotIds(day));
    if (duplicateIds.length > 0) {
      throw new Error(`Duplicate timeslot identifiers: ${duplicateIds.join(', ')}`);
    }

    const call = httpsCallable<
      { tournament: Tournament; attendee: Attendee },
      { tournament: Tournament; attendee: Attendee }
    >(this.functions, 'createTournament');
    return from(call({ tournament, attendee })).pipe(
      map((result) => result.data),
      tap((result) => {
        Object.assign(tournament, result.tournament);
        Object.assign(attendee, result.attendee);
        this.setCurrentTournament(result.tournament);
      }),
    );
  }

  /** Uses the complete server cascade instead of deleting a tournament document alone. */
  public override async delete(id: string): Promise<void> {
    await httpsCallable<{ tournamentId: string }, unknown>(this.functions, 'deleteTournament', {
      timeout: 540000,
    })({ tournamentId: id });
  }

  /** Restores the selected tournament if it still exists. */
  public loadCurrentTournamentFromLocalStorage(): Observable<Tournament | undefined> {
    const tournamentId = localStorage.getItem('currentTournamentId');
    if (!tournamentId) return of(undefined);
    return this.byId(tournamentId).pipe(
      map((t) => {
        if (t) {
          this.setCurrentTournament(t);
        } else {
          console.warn('No tournament found in local storage: ', tournamentId);
          localStorage.removeItem('currentTournamentId');
        }
        return t;
      }),
    );
  }

  /** Updates the selected tournament and its local identifier. */
  public setCurrentTournament(tournament: Tournament | null) {
    this.currentTournament$.set(tournament);
    // store the current tournament in local storage
    if (tournament) {
      localStorage.setItem('currentTournamentId', tournament.id);
    } else {
      localStorage.removeItem('currentTournamentId');
    }
  }
  /** Returns the currently selected tournament. */
  public getCurrentTournament(): Tournament | null {
    return this.currentTournament$();
  }

  /** Finds a team within the tournament divisions. */
  public getTeam(tournament: Tournament, teamId: string) {
    let res: Team | undefined;
    tournament.divisions.find((division) => (res = division.teams.find((team) => team.id === teamId)));
    return res;
  }
}
