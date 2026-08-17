import { Injectable } from '@angular/core';
import { AbstractPersistentDataService } from './abstract-persistent-data.service';
import { colTournamentRefereeAllocation, TournamentRefereeAllocation } from '@tournament-manager/persistent-data-model';
import { Observable } from 'rxjs';
import { deleteField, doc, query, updateDoc, where } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class TournamentRefereeAllocationService extends AbstractPersistentDataService<TournamentRefereeAllocation> {

  protected override getCollectionName(): string { return colTournamentRefereeAllocation; }

  byTournament(tournamentId: string): Observable<TournamentRefereeAllocation[]> {
    return this.query(query(this.itemsCollection(), where('tournamentId', '==', tournamentId)));
  }

  /** Removes the optional general configuration from a tournament allocation. */
  deleteGeneralConfig(allocationId: string): Promise<void> {
    return updateDoc(doc(this.itemsCollection(), allocationId), { generalConfig: deleteField() });
  }
}
