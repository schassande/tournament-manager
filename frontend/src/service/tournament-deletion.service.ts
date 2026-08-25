import { inject, Injectable } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  Firestore,
  getDocs,
  query,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import {
  colAttendee,
  colFitData,
  colFragmentRefereeAllocation,
  colFragmentRefereeAllocationStatistics,
  colGame,
  colGameAttendeeAllocation,
  colRefereeUpgradeCoachVote,
  colRefereeUpgradePanelVote,
  colTournament,
  colTournamentRefereeAllocation,
  colTournamentRefereeAllocationStatistics,
} from '@tournament-manager/persistent-data-model';
import { Observable } from 'rxjs';

/** Progress information emitted while a tournament and its related data are deleted. */
export interface TournamentDeletionProgress {
  /** Percentage of the deletion operation already completed. */
  percentage: number;
  /** Name of the collection currently being processed. */
  collection: string;
  /** Number of documents deleted so far. */
  deletedDocuments: number;
  /** Number of documents to delete, including the tournament document. */
  totalDocuments: number;
}

interface DeletionCollection {
  name: string;
  label: string;
}

const RELATED_COLLECTIONS: readonly DeletionCollection[] = [
  { name: colAttendee, label: 'attendees' },
  { name: colGame, label: 'games' },
  { name: colGameAttendeeAllocation, label: 'game allocations' },
  { name: colTournamentRefereeAllocation, label: 'tournament allocations' },
  { name: colFragmentRefereeAllocation, label: 'fragment allocations' },
  { name: colTournamentRefereeAllocationStatistics, label: 'tournament statistics' },
  { name: colFragmentRefereeAllocationStatistics, label: 'fragment statistics' },
  { name: colRefereeUpgradeCoachVote, label: 'coach upgrade votes' },
  { name: colRefereeUpgradePanelVote, label: 'panel upgrade votes' },
  { name: colFitData, label: 'FIT snapshots' },
];

/** Deletes all Firestore data owned by one tournament. */
@Injectable({ providedIn: 'root' })
export class TournamentDeletionService {
  private readonly firestore = inject(Firestore);

  /**
   * Queries every related collection by `tournamentId` and deletes documents in
   * Firestore batches, emitting progress after each committed batch.
   */
  deleteTournament(tournamentId: string): Observable<TournamentDeletionProgress> {
    return new Observable<TournamentDeletionProgress>((subscriber) => {
      void this.deleteTournamentInternal(tournamentId, subscriber);
    });
  }

  private async deleteTournamentInternal(
    tournamentId: string,
    subscriber: { next: (progress: TournamentDeletionProgress) => void; complete: () => void; error: (error: unknown) => void },
  ): Promise<void> {
    try {
      const snapshots = await Promise.all(RELATED_COLLECTIONS.map(({ name }) =>
        getDocs(query(collection(this.firestore, name), where('tournamentId', '==', tournamentId))),
      ));
      const documents = snapshots.flatMap((snapshot) => snapshot.docs);
      const totalDocuments = documents.length + 1;
      let deletedDocuments = 0;
      subscriber.next({ percentage: 0, collection: 'Preparing deletion', deletedDocuments, totalDocuments });

      for (let collectionIndex = 0; collectionIndex < RELATED_COLLECTIONS.length; collectionIndex++) {
        const collectionInfo = RELATED_COLLECTIONS[collectionIndex];
        const collectionDocuments = snapshots[collectionIndex].docs;
        for (let index = 0; index < collectionDocuments.length; index += 500) {
          const batch = writeBatch(this.firestore);
          collectionDocuments.slice(index, index + 500).forEach((document) => batch.delete(document.ref));
          await batch.commit();
          deletedDocuments += Math.min(500, collectionDocuments.length - index);
          subscriber.next(this.progress(collectionInfo.label, deletedDocuments, totalDocuments));
        }
      }

      await deleteDoc(doc(this.firestore, `${colTournament}/${tournamentId}`));
      subscriber.next(this.progress('tournament', totalDocuments, totalDocuments));
      subscriber.complete();
    } catch (error) {
      subscriber.error(error);
    }
  }

  private progress(collectionName: string, deletedDocuments: number, totalDocuments: number): TournamentDeletionProgress {
    return {
      percentage: totalDocuments === 0 ? 100 : Math.round((deletedDocuments / totalDocuments) * 100),
      collection: collectionName,
      deletedDocuments,
      totalDocuments,
    };
  }
}
