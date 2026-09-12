import { EnvironmentInjector, inject, Injectable, runInInjectionContext } from '@angular/core';
import { doc, query, where, writeBatch } from '@angular/fire/firestore';
import { defer, Observable } from 'rxjs';
import {
  CoachRefereesRanking,
  colCoachRefereesRanking,
  colTournamentRefereeRanking,
  IndividualRankingChanges,
  IndividualRankingSave,
  prepareIndividualRanking,
  TournamentRefereeRanking,
} from '@tournament-manager/persistent-data-model';
import { AbstractPersistentDataService } from './abstract-persistent-data.service';

/** Shares all individual rankings for the selected parent with the page's tabs. */
@Injectable({ providedIn: 'root' })
export class RefereesRankingService extends AbstractPersistentDataService<CoachRefereesRanking> {
  protected override autoIdAllocation = false;
  private readonly context = inject(EnvironmentInjector);

  /** Commits the owner action and any required narrow parent freshness write atomically. */
  saveIndividual(
    parent: TournamentRefereeRanking,
    previous: CoachRefereesRanking | null,
    coachId: string,
    changes: IndividualRankingChanges,
  ): Observable<IndividualRankingSave> {
    return defer(() =>
      runInInjectionContext(this.context, () => {
        const result = prepareIndividualRanking(parent, previous, coachId, changes);
        const batch = writeBatch(this.firestore);
        batch.set(doc(this.firestore, colCoachRefereesRanking, result.individual.id), result.individual);
        if (result.panelResultState !== parent.panelResultState) {
          batch.update(doc(this.firestore, colTournamentRefereeRanking, parent.id), {
            panelResultState: result.panelResultState,
            updatedByCoachAttendeeId: coachId,
            lastChange: result.individual.lastChange,
          });
        }
        return batch.commit().then(() => result);
      }),
    );
  }

  /** Identifies the individual ranking collection. */
  protected override getCollectionName(): string {
    return colCoachRefereesRanking;
  }

  /** Loads every coach record for one parent in a single query, including practice records. */
  findByRanking(rankingId: string): Observable<CoachRefereesRanking[]> {
    return this.query(query(this.itemsCollection(), where('tournamentRefereeRankingId', '==', rankingId)));
  }
}
