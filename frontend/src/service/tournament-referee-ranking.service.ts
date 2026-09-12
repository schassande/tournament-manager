import { inject, Injectable } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { doc, query, updateDoc, where } from '@angular/fire/firestore';
import { defer, map, Observable } from 'rxjs';
import {
  colTournamentRefereeRanking,
  rankingFromStorage,
  rankingToStorage,
  RefereeRankingStatus,
  refereeRankingTransitions,
  StoredTournamentRefereeRanking,
  TournamentRefereeRanking,
  RankingRefereeChanges,
  RankingMaintenanceRequest,
  RankingMaintenanceResponse,
  RemoveRankingRefereesRequest,
} from '@tournament-manager/persistent-data-model';
import { AbstractPersistentDataService } from './abstract-persistent-data.service';

/** Loads and creates parent rankings through their Firestore-safe representation. */
@Injectable({ providedIn: 'root' })
export class TournamentRefereeRankingService extends AbstractPersistentDataService<StoredTournamentRefereeRanking> {
  private readonly functions = inject(Functions);

  /** Saves valid metadata or selection additions; cross-owner removals use the backend. */
  saveReferees(
    ranking: TournamentRefereeRanking,
    patch: RankingRefereeChanges,
    coachId: string,
  ): Observable<TournamentRefereeRanking> {
    return defer(() => {
      const next = { ...ranking, ...patch, name: (patch.name ?? ranking.name).trim() };
      if (
        ranking.status === 'CLOSED' ||
        !next.name ||
        !Number.isSafeInteger(next.nbRefereesToRank) ||
        next.nbRefereesToRank < 1
      ) {
        throw new Error('A name and a positive safe integer target are required on an open ranking.');
      }
      if (ranking.selectedRefereeAttendeeIds.some((id) => !next.selectedRefereeAttendeeIds.includes(id))) {
        throw new Error('Referee removal requires atomic maintenance.');
      }
      const selectionChanged = next.selectedRefereeAttendeeIds.length !== ranking.selectedRefereeAttendeeIds.length;
      const changes = {
        ...patch,
        name: next.name,
        updatedByCoachAttendeeId: coachId,
        lastChange: Date.now(),
        panelResultState:
          selectionChanged && ranking.panelResultState !== 'NOT_COMPUTED'
            ? ('STALE' as const)
            : ranking.panelResultState,
      };
      return updateDoc(doc(this.firestore, colTournamentRefereeRanking, ranking.id), changes).then(() => ({
        ...ranking,
        ...changes,
      }));
    });
  }

  /** Removes selected referees and every associated reference in a single server transaction. */
  removeReferees(request: RemoveRankingRefereesRequest): Observable<RankingMaintenanceResponse> {
    return defer(() =>
      httpsCallable<RemoveRankingRefereesRequest, RankingMaintenanceResponse>(
        this.functions,
        'removeRankingReferees',
      )(request),
    ).pipe(map((response) => response.data));
  }

  /** Repairs invalid persisted references discovered by the page; CLOSED remains untouched. */
  repairRanking(request: RankingMaintenanceRequest): Observable<RankingMaintenanceResponse> {
    return defer(() =>
      httpsCallable<RankingMaintenanceRequest, RankingMaintenanceResponse>(
        this.functions,
        'repairRefereeRanking',
      )(request),
    ).pipe(map((response) => response.data));
  }
  /** Identifies the parent ranking collection. */
  protected override getCollectionName(): string {
    return colTournamentRefereeRanking;
  }

  /** Loads all rankings for one tournament in a single query. */
  findByTournament(tournamentId: string): Observable<TournamentRefereeRanking[]> {
    return this.query(query(this.itemsCollection(), where('tournamentId', '==', tournamentId))).pipe(
      map((rankings) => rankings.map(rankingFromStorage)),
    );
  }

  /** Creates an unsaved ranking without exposing nested arrays to Firestore. */
  createRanking(ranking: TournamentRefereeRanking): Observable<TournamentRefereeRanking> {
    if (ranking.id) throw new Error('A new ranking must not already have an identifier.');
    return super.save(rankingToStorage(ranking)).pipe(map(rankingFromStorage));
  }

  /** Persists only the requested legal phase and actor metadata, leaving votes untouched. */
  changeStatus(
    ranking: TournamentRefereeRanking,
    status: RefereeRankingStatus,
    coachAttendeeId: string,
  ): Observable<TournamentRefereeRanking> {
    return defer(() => {
      if (!refereeRankingTransitions(ranking).includes(status))
        throw new Error('This status transition is not allowed.');
      const changes = { status, updatedByCoachAttendeeId: coachAttendeeId, lastChange: Date.now() };
      const reference = doc(this.firestore, colTournamentRefereeRanking, ranking.id);
      return updateDoc(reference, changes).then(() => ({ ...ranking, ...changes }));
    });
  }
}
