import { Injectable } from '@angular/core';
import { query, where } from '@angular/fire/firestore';
import { AbstractPersistentDataService } from '../abstract-persistent-data.service';
import { GameAttendeeAllocation } from '../data.model';
import { Observable } from 'rxjs';


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
