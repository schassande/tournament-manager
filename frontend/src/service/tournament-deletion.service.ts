import { inject, Injectable } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { from, map, Observable, startWith } from 'rxjs';

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

/** Deletes tournament data through a retryable authorized server cascade. */
@Injectable({ providedIn: 'root' })
export class TournamentDeletionService {
  private readonly functions = inject(Functions);

  /** Emits preparation and confirmed completion; retry resumes a partial server deletion. */
  deleteTournament(tournamentId: string): Observable<TournamentDeletionProgress> {
    const call = httpsCallable<{ tournamentId: string }, { deletedDocuments: number }>(
      this.functions,
      'deleteTournament',
      { timeout: 540000 },
    );
    return from(call({ tournamentId })).pipe(
      map((result) => ({
        percentage: 100,
        collection: 'tournament',
        deletedDocuments: result.data.deletedDocuments,
        totalDocuments: result.data.deletedDocuments,
      })),
      startWith({ percentage: 0, collection: 'Deleting tournament', deletedDocuments: 0, totalDocuments: 0 }),
    );
  }
}
