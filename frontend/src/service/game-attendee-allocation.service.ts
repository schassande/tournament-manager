import { Injectable } from '@angular/core';
import { getDocs, query, where, writeBatch } from '@angular/fire/firestore';
import { from, Observable } from 'rxjs';
import { colGameAttendeeAllocation, GameAttendeeAllocation } from '@tournament-manager/persistent-data-model';
import { AbstractPersistentDataService } from './abstract-persistent-data.service';


@Injectable({
  providedIn: 'root'
})
export class GameAttendeeAllocationService extends AbstractPersistentDataService<GameAttendeeAllocation> {

  protected override getCollectionName(): string { return colGameAttendeeAllocation; }

  byGame(tournamentId: string, gameId: string): Observable<GameAttendeeAllocation[]> {
    return this.query(query(this.itemsCollection(),
      where('tournamentId', '==', tournamentId),
      where('gameId', '==', gameId)
    ));
  }

  byAllocation(tournamentId: string, refereeAllocationId: string): Observable<GameAttendeeAllocation[]> {
    return this.query(query(this.itemsCollection(),
      where('tournamentId', '==', tournamentId),
      where('fragmentRefereeAllocationId', '==', refereeAllocationId)));
  }

  /** Deletes all game assignments belonging to a fragment in Firestore batches. */
  deleteByAllocation(tournamentId: string, refereeAllocationId: string): Observable<void> {
    const allocationQuery = query(this.itemsCollection(),
      where('tournamentId', '==', tournamentId),
      where('fragmentRefereeAllocationId', '==', refereeAllocationId));
    return from(getDocs(allocationQuery).then(snapshot => {
      const documents = snapshot.docs;
      const commits: Promise<void>[] = [];
      for (let index = 0; index < documents.length; index += 500) {
        const batch = writeBatch(this.firestore);
        documents.slice(index, index + 500).forEach(document => batch.delete(document.ref));
        commits.push(batch.commit());
      }
      return Promise.all(commits).then(() => undefined);
    }));
  }
}
