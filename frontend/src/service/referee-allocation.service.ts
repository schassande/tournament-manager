import { Injectable } from '@angular/core';
import { AbstractPersistentDataService } from './abstract-persistent-data.service';
import { RefereeAllocation } from '../data.model';
import { Observable } from 'rxjs';
import { query, where } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class RefereeAllocationService extends AbstractPersistentDataService<RefereeAllocation> {

  protected override getCollectionName(): string {
      return 'referee-allocation';
  }

  byTournament(tournamentId: string): Observable<RefereeAllocation[]> {
    return this.query(query(this.itemsCollection(), where('tournamentId', '==', tournamentId)));
  }
}
