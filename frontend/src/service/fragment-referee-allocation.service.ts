import { Injectable } from '@angular/core';
import { AbstractPersistentDataService } from './abstract-persistent-data.service';
import {
  colFragmentRefereeAllocation,
  FragmentRefereeAllocation,
  GeneralAllocationConfiguration,
} from '@tournament-manager/persistent-data-model';
import { Observable } from 'rxjs';
import { deleteField, doc, query, updateDoc, where } from '@angular/fire/firestore';
import { GameView } from '../allocation-data-model';

@Injectable({
  providedIn: 'root',
})
export class FragmentRefereeAllocationService extends AbstractPersistentDataService<FragmentRefereeAllocation> {
  private readonly counterQueues = new Map<string, Promise<void>>();

  /** Computes the rounded percentage of games allocated in a displayed fragment. */
  static computeAllocatedGamesPercentage(gameCount: number, nbGamesAllocated: number | undefined): number | undefined {
    if (nbGamesAllocated === undefined || gameCount === 0) return undefined;
    return Math.round((nbGamesAllocated / gameCount) * 100);
  }

  /** Counts games having at least the configured number of referee assignments. */
  static countAllocatedGames(games: GameView[], nbRefereePerGame: number): number {
    return games.filter((game) => game.referees.length >= nbRefereePerGame).length;
  }

  protected override getCollectionName(): string {
    return colFragmentRefereeAllocation;
  }

  byTournament(tournamentId: string): Observable<FragmentRefereeAllocation[]> {
    return this.query(query(this.itemsCollection(), where('tournamentId', '==', tournamentId)));
  }

  /** Removes the optional general configuration from a fragment allocation. */
  deleteGeneralConfig(allocationId: string): Promise<void> {
    return updateDoc(doc(this.itemsCollection(), allocationId), { generalConfig: deleteField() });
  }

  /** Enqueues a counter update while keeping updates for one fragment ordered. */
  enqueueGamesAllocatedUpdate(
    allocation: FragmentRefereeAllocation,
    games: GameView[] | (() => GameView[]),
    configuration: GeneralAllocationConfiguration,
  ): void {
    const getGames = typeof games === 'function' ? games : () => games;
    const previous = this.counterQueues.get(allocation.id) ?? Promise.resolve();
    const update = previous
      .catch(() => undefined)
      .then(() =>
        this.updateGamesAllocated(
          allocation.id,
          FragmentRefereeAllocationService.countAllocatedGames(getGames(), configuration.nbRefereePerGame),
        ),
      )
      .catch((error) => console.error('Unable to update allocated games counter', error))
      .finally(() => {
        if (this.counterQueues.get(allocation.id) === update) this.counterQueues.delete(allocation.id);
      });
    this.counterQueues.set(allocation.id, update);
  }

  /** Persists the number of fully allocated games for a fragment. */
  private updateGamesAllocated(allocationId: string, count: number): Promise<void> {
    return updateDoc(doc(this.itemsCollection(), allocationId), {
      nbGamesAllocated: count,
      lastChange: new Date().getTime(),
    });
  }
}
