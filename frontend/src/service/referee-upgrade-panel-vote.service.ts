import { Injectable } from '@angular/core';
import { query, where } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import {
  RefereeUpgradePanelVote,
  colRefereeUpgradePanelVote,
  refereeUpgradePanelVoteId,
} from '@tournament-manager/persistent-data-model';
import { AbstractPersistentDataService } from './abstract-persistent-data.service';

/** Firestore service for referee panel upgrade decisions. */
@Injectable({ providedIn: 'root' })
export class RefereeUpgradePanelVoteService extends AbstractPersistentDataService<RefereeUpgradePanelVote> {
  protected override getCollectionName(): string {
    return colRefereeUpgradePanelVote;
  }

  protected override autoIdAllocation = false;

  /** Load all panel decisions belonging to one tournament. */
  public findByTournament(tournamentId: string): Observable<RefereeUpgradePanelVote[]> {
    return this.query(query(this.itemsCollection(), where('tournamentId', '==', tournamentId)));
  }

  /** Persist a panel decision using its deterministic identity and business rules. */
  public override save(item: RefereeUpgradePanelVote): Observable<RefereeUpgradePanelVote> {
    item.id = refereeUpgradePanelVoteId(item.tournamentId, item.refereeAttendeeId);
    item.needToSee = [...new Set(item.needToSee ?? [])];
    if (item.vote !== 'Not yet') {
      item.needToTalk = null;
    }
    return super.save(item);
  }
}
