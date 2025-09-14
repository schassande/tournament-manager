import { Injectable } from '@angular/core';
import { AbstractPersistentDataService } from './abstract-persistent-data.service';
import { colTournamentRefereeAllocationStatistics,  TournamentRefereeAllocationStatistics } from '@tournament-manager/persistent-data-model';
import { Observable } from 'rxjs';
import { query, where } from '@angular/fire/firestore';
import { doc, getDocs, writeBatch } from 'firebase/firestore';

@Injectable({
  providedIn: 'root'
})
export class TournamentRefereeAllocationStatisticsService extends AbstractPersistentDataService<TournamentRefereeAllocationStatistics> {

  protected override getCollectionName(): string { return colTournamentRefereeAllocationStatistics; }

  byTournament(tournamentId: string): Observable<TournamentRefereeAllocationStatistics[]> {
    return this.query(query(this.itemsCollection(), where('tournamentId', '==', tournamentId)));
  }

  async deleteByAllocationId(tournamentRefereeAllocationId: string): Promise<any> {
    const q = query(this.itemsCollection(), where('tournamentRefereeAllocationId', '==', tournamentRefereeAllocationId));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return;
    }
    // Create a batch
    const batch = writeBatch(this.firestore);
    // add the deletion of all items in the batch
    querySnapshot.docs.forEach((document) => {
      batch.delete(doc(this.firestore, `${this.getCollectionName}/${document.id}`));
    });
    // Run the batch
    return batch.commit();
  }
}
