import { Observable } from 'rxjs';
import { Injectable } from '@angular/core';
import { Attendee, AttendeeRole } from '@tournament-manager/persistent-data-model';
import { AbstractPersistentDataService } from './abstract-persistent-data.service';
import { query, where } from '@angular/fire/firestore';

export const nonRefereeRoles: AttendeeRole[] = ['Player', 'Coach', 'CoachReferee', 'RefereeUpgrade', 'RefereeRanker', 'TournamentManager', 'GameAllocator', 'ResultManager'];
export const nonRefereeCoachRoles: AttendeeRole[] = ['Player', 'Coach', 'Referee', 'TournamentManager', 'GameAllocator', 'ResultManager'];

@Injectable({
  providedIn: 'root'
})
export class AttendeeService extends AbstractPersistentDataService<Attendee>{

  protected override getCollectionName(): string { return 'attendee'; }

  protected override adjustItemOnLoad(item: Attendee): Attendee {
    if (item.refereeCoach) {
      const fontColor = this.normalizeCoachColor(item.refereeCoach.fontColor, '#000000');
      const backgroundColor = this.normalizeCoachColor(item.refereeCoach.backgroundColor, '#ffffff');
      const changed = fontColor !== item.refereeCoach.fontColor
        || backgroundColor !== item.refereeCoach.backgroundColor;
      item.refereeCoach.fontColor = fontColor;
      item.refereeCoach.backgroundColor = backgroundColor;
      if (changed) {
        this.save(item).subscribe()
      }
    }
    return item;
  }

  /** Normalizes legacy hexadecimal coach colors to valid CSS color values. */
  private normalizeCoachColor(color: string | undefined, fallback: string): string {
    if (!color) return fallback;
    return /^x?[0-9a-f]{6}$/i.test(color)
      ? `#${color.replace(/^x/i, '')}`
      : color;
  }
  findByPerson(tournamentId: string, personId: string): Observable<Attendee[]> {
    return this.query(
      query(this.itemsCollection(),
      where('tournamentId', '==', tournamentId),
      where('personId', '==', personId)
      )
    );
  }

  /**
   * Loads only the attendees belonging to a tournament.
   * @param tournamentId identifier of the tournament
   * @returns attendees attached to the tournament
   */
  findByTournament(tournamentId: string): Observable<Attendee[]> {
    return this.query(
      query(this.itemsCollection(), where('tournamentId', '==', tournamentId))
    );
  }

  findTournamentManager(tournamentId: string): Observable<Attendee[]> {
    return this.query(
      query(this.itemsCollection(),
      where('tournamentId', '==', tournamentId),
      where('isTournamentManager', '==', true)
      )
    );
  }
  findTournamentReferees(tournamentId: string): Observable<Attendee[]> {
    return this.query(
      query(this.itemsCollection(),
      where('tournamentId', '==', tournamentId),
      where('isReferee', '==', true)
      )
    );
  }
  findTournamentRefereeCoaches(tournamentId: string): Observable<Attendee[]> {
    return this.query(
      query(this.itemsCollection(),
      where('tournamentId', '==', tournamentId),
      where('isRefereeCoach', '==', true)
      )
    );
  }
  isOnlyReferee(attendee: Attendee): boolean {
    return attendee.roles.filter(role =>  nonRefereeRoles.indexOf(role) >= 0).length === 0;
  }
  isOnlyRefereeCoach(attendee: Attendee): boolean {
    return attendee.roles.filter(role =>  nonRefereeCoachRoles.indexOf(role) >= 0).length === 0 ;
  }
}
