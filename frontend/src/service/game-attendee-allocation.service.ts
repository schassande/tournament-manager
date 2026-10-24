import { Injectable } from '@angular/core';
import { getDocs, query, where, writeBatch } from '@angular/fire/firestore';
import { from, Observable } from 'rxjs';
import { colGameAttendeeAllocation, GameAttendeeAllocation } from '@tournament-manager/persistent-data-model';
import { AbstractPersistentDataService } from './abstract-persistent-data.service';

/** Persists match assignments and supports referee/coach resets without deleting self-assignments. */
@Injectable({
  providedIn: 'root',
})
export class GameAttendeeAllocationService extends AbstractPersistentDataService<GameAttendeeAllocation> {
  /** Returns the shared collection used by every match-assignment role. */
  protected override getCollectionName(): string {
    return colGameAttendeeAllocation;
  }

  /** Reads the assignments for one tournament game. */
  byGame(tournamentId: string, gameId: string): Observable<GameAttendeeAllocation[]> {
    return this.query(
      query(this.itemsCollection(), where('tournamentId', '==', tournamentId), where('gameId', '==', gameId)),
    );
  }

  /** Reads assignments scoped to one allocation fragment. */
  byAllocation(tournamentId: string, refereeAllocationId: string): Observable<GameAttendeeAllocation[]> {
    return this.query(
      query(
        this.itemsCollection(),
        where('tournamentId', '==', tournamentId),
        where('fragmentRefereeAllocationId', '==', refereeAllocationId),
      ),
    );
  }

  /** Returns all role assignments belonging to a tournament. */
  byTournament(tournamentId: string): Observable<GameAttendeeAllocation[]> {
    return this.query(query(this.itemsCollection(), where('tournamentId', '==', tournamentId)));
  }

  /** Resets referee/coach assignments in batches while preserving independent water-carrier self-assignments. */
  deleteByAllocation(tournamentId: string, refereeAllocationId: string): Observable<void> {
    const allocationQuery = query(
      this.itemsCollection(),
      where('tournamentId', '==', tournamentId),
      where('fragmentRefereeAllocationId', '==', refereeAllocationId),
    );
    return from(
      getDocs(allocationQuery).then((snapshot) => {
        const documents = snapshot.docs.filter((document) => document.data()['attendeeRole'] !== 'WaterCarrier');
        const commits: Promise<void>[] = [];
        for (let index = 0; index < documents.length; index += 500) {
          const batch = writeBatch(this.firestore);
          documents.slice(index, index + 500).forEach((document) => batch.delete(document.ref));
          commits.push(batch.commit());
        }
        return Promise.all(commits).then(() => undefined);
      }),
    );
  }
}
