import { Injectable } from '@angular/core';
import { AbstractPersistentDataService } from './abstract-persistent-data.service';
import { colFragmentRefereeAllocation, FragmentRefereeAllocation } from '@tournament-manager/persistent-data-model';
import { Observable } from 'rxjs';
import { deleteField, doc, query, updateDoc, where } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class FragmentRefereeAllocationService extends AbstractPersistentDataService<FragmentRefereeAllocation> {

  protected override getCollectionName(): string { return colFragmentRefereeAllocation; }

  byTournament(tournamentId: string): Observable<FragmentRefereeAllocation[]> {
    return this.query(query(this.itemsCollection(), where('tournamentId', '==', tournamentId)));
  }

  /** Removes the optional general configuration from a fragment allocation. */
  deleteGeneralConfig(allocationId: string): Promise<void> {
    return updateDoc(doc(this.itemsCollection(), allocationId), { generalConfig: deleteField() });
  }
}
