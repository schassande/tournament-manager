import { Injectable } from '@angular/core';
import { query, where } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import {
  RefereeUpgradeCoachVote,
  colRefereeUpgradeCoachVote,
  refereeUpgradeCoachVoteId,
} from '@tournament-manager/persistent-data-model';
import { AbstractPersistentDataService } from './abstract-persistent-data.service';

/** Firestore service for referee coach upgrade votes. */
@Injectable({ providedIn: 'root' })
export class RefereeUpgradeCoachVoteService extends AbstractPersistentDataService<RefereeUpgradeCoachVote> {
  protected override getCollectionName(): string {
    return colRefereeUpgradeCoachVote;
  }

  protected override autoIdAllocation = false;

  /** Load all coach votes belonging to one tournament. */
  public findByTournament(tournamentId: string): Observable<RefereeUpgradeCoachVote[]> {
    return this.query(query(this.itemsCollection(), where('tournamentId', '==', tournamentId)));
  }

  /** Persist a coach vote using its deterministic identity. */
  public override save(item: RefereeUpgradeCoachVote): Observable<RefereeUpgradeCoachVote> {
    item.id = refereeUpgradeCoachVoteId(item.tournamentId, item.refereeAttendeeId, item.coachAttendeeId);
    item.comments = normalizeComments(item.comments);
    return super.save(item);
  }
}

function normalizeComments(comments: string[]): string[] {
  return comments
    .flatMap((comment) => comment.split(/\r?\n/))
    .map((comment) => comment.trim())
    .filter((comment) => comment.length > 0);
}
