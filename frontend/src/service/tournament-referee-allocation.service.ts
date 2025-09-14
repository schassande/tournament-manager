import { Injectable } from '@angular/core';
import { AbstractPersistentDataService } from './abstract-persistent-data.service';
import { colTournamentRefereeAllocation, TournamentRefereeAllocation } from '@tournament-manager/persistent-data-model';
import { Observable } from 'rxjs';
import { query, where } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class TournamentRefereeAllocationService extends AbstractPersistentDataService<TournamentRefereeAllocation> {

  protected override getCollectionName(): string { return colTournamentRefereeAllocation; }

  byTournament(tournamentId: string): Observable<TournamentRefereeAllocation[]> {
    return this.query(query(this.itemsCollection(), where('tournamentId', '==', tournamentId)));
  }
}
