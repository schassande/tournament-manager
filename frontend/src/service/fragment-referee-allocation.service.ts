import { Injectable } from '@angular/core';
import { AbstractPersistentDataService } from './abstract-persistent-data.service';
import { colFragmentRefereeAllocation, FragmentRefereeAllocation } from '@tournament-manager/persistent-data-model';
import { Observable } from 'rxjs';
import { query, where } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class FragmentRefereeAllocationService extends AbstractPersistentDataService<FragmentRefereeAllocation> {

  protected override getCollectionName(): string { return colFragmentRefereeAllocation; }

  byTournament(tournamentId: string): Observable<FragmentRefereeAllocation[]> {
    return this.query(query(this.itemsCollection(), where('tournamentId', '==', tournamentId)));
  }
}
