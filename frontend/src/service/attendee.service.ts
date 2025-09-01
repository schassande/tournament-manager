import { Observable } from 'rxjs';
import { Injectable } from '@angular/core';
import { Attendee, AttendeeRole } from '../data.model';
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
    if (item.refereeCoach && (!item.refereeCoach.fontColor || !item.refereeCoach.backgroundColor)) {
      item.refereeCoach.fontColor= 'x000000';
      item.refereeCoach.backgroundColor= 'xffffff';
      this.save(item).subscribe()
    }
    return item;
  }
  findByPerson(tournamentId: string, personId: string): Observable<Attendee[]> {
    return this.query(
      query(this.itemsCollection(),
      where('tournamentId', '==', tournamentId),
      where('personId', '==', personId)
      )
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
