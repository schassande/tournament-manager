import { Injectable } from '@angular/core';
import { query, where } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { GameAttendeeAllocation } from '../data.model';
import { AbstractPersistentDataService } from './abstract-persistent-data.service';


@Injectable({
  providedIn: 'root'
})
export class GameAttendeeAllocationService extends AbstractPersistentDataService<GameAttendeeAllocation> {

  protected override getCollectionName(): string { return 'game-attendee-allocation'; }

  byGame(tournamentId: string, gameId: string): Observable<GameAttendeeAllocation[]> {
    return this.query(query(this.itemsCollection(),
      where('tournamentId', '==', tournamentId),
      where('gameId', '==', gameId)
    ));
  }

  byAllocation(tournamentId: string, refereeAllocationId: string): Observable<GameAttendeeAllocation[]> {
    return this.query(query(this.itemsCollection(),
      where('tournamentId', '==', tournamentId),
      where('refereeAllocationId', '==', refereeAllocationId)));
  }
}
