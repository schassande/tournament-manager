import { Injectable } from '@angular/core';
import { query, where } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { CoachRefereesRanking, colCoachRefereesRanking } from '@tournament-manager/persistent-data-model';
import { AbstractPersistentDataService } from './abstract-persistent-data.service';

/** Shares all individual rankings for the selected parent with the page's tabs. */
@Injectable({ providedIn: 'root' })
export class RefereesRankingService extends AbstractPersistentDataService<CoachRefereesRanking> {
  protected override autoIdAllocation = false;

  /** Identifies the individual ranking collection. */
  protected override getCollectionName(): string {
    return colCoachRefereesRanking;
  }

  /** Loads every coach record for one parent in a single query, including practice records. */
  findByRanking(rankingId: string): Observable<CoachRefereesRanking[]> {
    return this.query(query(this.itemsCollection(), where('tournamentRefereeRankingId', '==', rankingId)));
  }
}
