import { from, map, Observable, tap } from 'rxjs';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { inject, Injectable } from '@angular/core';
import { Attendee, AttendeeRole } from '@tournament-manager/persistent-data-model';
import { AbstractPersistentDataService } from './abstract-persistent-data.service';
import { query, where } from '@angular/fire/firestore';

export const nonRefereeRoles: AttendeeRole[] = [
  'Player',
  'Coach',
  'CoachReferee',
  'RefereeUpgrade',
  'RefereeRanker',
  'TournamentManager',
  'GameAllocator',
  'ResultManager',
];
export const nonRefereeCoachRoles: AttendeeRole[] = [
  'Player',
  'Coach',
  'Referee',
  'TournamentManager',
  'GameAllocator',
  'ResultManager',
];

@Injectable({
  providedIn: 'root',
})
export class AttendeeService extends AbstractPersistentDataService<Attendee> {
  private readonly functions = inject(Functions);

  /** Saves through the authorized server transaction and preserves caller object identity. */
  public override save(item: Attendee): Observable<Attendee> {
    const call = httpsCallable<{ attendee: Attendee }, Attendee>(this.functions, 'saveAttendee');
    return from(call({ attendee: item })).pipe(
      map((result) => result.data),
      tap((saved) => Object.assign(item, saved)),
    );
  }

  /** Deletes the participant and its identity index through the server. */
  public override async delete(id: string): Promise<void> {
    await httpsCallable<{ id: string }, void>(this.functions, 'deleteAttendee')({ id });
  }

  /** Returns the persisted collection used by inherited read operations. */
  protected override getCollectionName(): string {
    return 'attendee';
  }

  /** Normalizes legacy presentation values in memory without granting write permissions. */
  protected override adjustItemOnLoad(item: Attendee): Attendee {
    if (item.refereeCoach) {
      const fontColor = this.normalizeCoachColor(item.refereeCoach.fontColor, '#000000');
      const backgroundColor = this.normalizeCoachColor(item.refereeCoach.backgroundColor, '#ffffff');
      item.refereeCoach.fontColor = fontColor;
      item.refereeCoach.backgroundColor = backgroundColor;
    }
    return item;
  }

  /** Normalizes legacy hexadecimal coach colors to valid CSS color values. */
  private normalizeCoachColor(color: string | undefined, fallback: string): string {
    if (!color) return fallback;
    return /^x?[0-9a-f]{6}$/i.test(color) ? `#${color.replace(/^x/i, '')}` : color;
  }
  /** Finds normalized-email membership independently of the optional Person link. */
  findByEmail(tournamentId: string, email: string): Observable<Attendee[]> {
    const normalized = email.trim().toLowerCase();
    return this.findByTournament(tournamentId).pipe(
      map((attendees) => attendees.filter((attendee) => attendee.person?.email?.trim().toLowerCase() === normalized)),
    );
  }

  /** Finds the attendees linked to a person within a tournament. */
  findByPerson(tournamentId: string, personId: string): Observable<Attendee[]> {
    return this.query(
      query(
        this.itemsCollection(),
        where('tournamentId', '==', tournamentId),
        where('person.personId', '==', personId),
      ),
    );
  }

  /**
   * Loads only the attendees belonging to a tournament.
   * @param tournamentId identifier of the tournament
   * @returns attendees attached to the tournament
   */
  findByTournament(tournamentId: string): Observable<Attendee[]> {
    return this.query(query(this.itemsCollection(), where('tournamentId', '==', tournamentId)));
  }

  /** Loads tournament managers using server-derived role flags. */
  findTournamentManager(tournamentId: string): Observable<Attendee[]> {
    return this.query(
      query(
        this.itemsCollection(),
        where('tournamentId', '==', tournamentId),
        where('isTournamentManager', '==', true),
      ),
    );
  }
  /** Loads tournament referees using server-derived role flags. */
  findTournamentReferees(tournamentId: string): Observable<Attendee[]> {
    return this.query(
      query(this.itemsCollection(), where('tournamentId', '==', tournamentId), where('isReferee', '==', true)),
    );
  }
  /** Loads tournament coaches using server-derived role flags. */
  findTournamentRefereeCoaches(tournamentId: string): Observable<Attendee[]> {
    return this.query(
      query(this.itemsCollection(), where('tournamentId', '==', tournamentId), where('isRefereeCoach', '==', true)),
    );
  }
  /** Reports whether an attendee has no roles outside referee participation. */
  isOnlyReferee(attendee: Attendee): boolean {
    return attendee.roles.filter((role) => nonRefereeRoles.indexOf(role) >= 0).length === 0;
  }
  /** Reports whether an attendee has no roles outside coach participation. */
  isOnlyRefereeCoach(attendee: Attendee): boolean {
    return attendee.roles.filter((role) => nonRefereeCoachRoles.indexOf(role) >= 0).length === 0;
  }
}
