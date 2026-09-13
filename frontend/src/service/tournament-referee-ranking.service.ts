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
  RankingCoachChanges,
  RankingMaintenanceRequest,
  RankingMaintenanceResponse,
  RemoveRankingRefereesRequest,
  Attendee,
  CoachRefereesRanking,
  RankingDeletionResponse,
} from '@tournament-manager/persistent-data-model';
import { AbstractPersistentDataService } from './abstract-persistent-data.service';
import { computePanelRanking } from './panel-ranking';

/** Loads and creates parent rankings through their Firestore-safe representation. */
@Injectable({ providedIn: 'root' })
export class TournamentRefereeRankingService extends AbstractPersistentDataService<StoredTournamentRefereeRanking> {
  private readonly functions = inject(Functions);

  /** Computes from grouped votes and returns CURRENT only after the Firestore result commit succeeds. */
  compute(
    ranking: TournamentRefereeRanking,
    individuals: readonly CoachRefereesRanking[],
    attendees: ReadonlyMap<string, Attendee>,
    coachId: string,
  ): Observable<TournamentRefereeRanking> {
    return defer(() => {
      if (ranking.status !== 'PANEL_RANKING') throw new Error('Compute requires Panel ranking.');
      const now = Date.now();
      const next: TournamentRefereeRanking = {
        ...ranking,
        panelRefereesRanking: computePanelRanking(ranking, individuals, attendees, now),
        panelResultState: 'CURRENT',
        updatedByCoachAttendeeId: coachId,
        lastChange: now,
      };
      // Persist only the result and actor metadata; storage maps avoid Firestore nested arrays.
      const changes = {
        panelRefereesRanking: rankingToStorage(next).panelRefereesRanking,
        panelResultState: next.panelResultState,
        updatedByCoachAttendeeId: coachId,
        lastChange: now,
      };
      return updateDoc(doc(this.firestore, colTournamentRefereeRanking, ranking.id), changes).then(() => next);
    });
  }

  /** Deletes the whole ranking through the authenticated cross-owner backend cascade. */
  deleteRanking(request: RankingMaintenanceRequest): Observable<RankingDeletionResponse> {
    return defer(() =>
      httpsCallable<RankingMaintenanceRequest, RankingDeletionResponse>(
        this.functions,
        'deleteRefereeRanking',
      )(request),
    ).pipe(map((response) => response.data));
  }

  /** Saves panel configuration only; individual votes, locks and timestamps remain untouched. */
  saveCoaches(
    ranking: TournamentRefereeRanking,
    patch: RankingCoachChanges,
    coachId: string,
  ): Observable<TournamentRefereeRanking> {
    return defer(() => {
      const majority = patch.voteMajority ?? ranking.voteMajority;
      const ids = patch.selectedCoachAttendeeIds ?? ranking.selectedCoachAttendeeIds;
      if (
        ranking.status === 'CLOSED' ||
        !Number.isSafeInteger(majority) ||
        majority < 1 ||
        ids.some((id) => typeof id !== 'string' || !id.trim()) ||
        new Set(ids).size !== ids.length
      ) {
        throw new Error('An open ranking, unique coach IDs and a positive safe integer majority are required.');
      }
      const changed =
        majority !== ranking.voteMajority ||
        ids.length !== ranking.selectedCoachAttendeeIds.length ||
        ids.some((id) => !ranking.selectedCoachAttendeeIds.includes(id));
      const changes = {
        ...patch,
        updatedByCoachAttendeeId: coachId,
        lastChange: Date.now(),
        panelResultState:
          changed && ranking.panelResultState !== 'NOT_COMPUTED' ? ('STALE' as const) : ranking.panelResultState,
      };
      return updateDoc(doc(this.firestore, colTournamentRefereeRanking, ranking.id), changes).then(() => ({
        ...ranking,
        ...changes,
      }));
    });
  }

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
