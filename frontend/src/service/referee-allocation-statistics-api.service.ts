import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { from, Observable, switchMap } from 'rxjs';
import { environment } from '../environments/environment';
import {
  FragmentRefereeAllocationStatistics,
  TournamentRefereeAllocationStatistics,
} from '@tournament-manager/persistent-data-model';

/** Persisted statistics returned by the authorized calculation endpoint. */
export interface RefereeAllocationStatisticsResponse {
  tournamentAllocationId: string;
  fragmentAllocationId: string;
  refereeAllocationStatistics: Array<{
    refereeAttendeeId: string;
    fragmentAllocationRefereeStatistics: FragmentRefereeAllocationStatistics;
    tournamentAllocationRefereeStatistics: TournamentRefereeAllocationStatistics;
  }>;
}

/** Calls the existing HTTP endpoint that computes and persists referee statistics. */
@Injectable({ providedIn: 'root' })
export class RefereeAllocationStatisticsApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);

  /** Computes statistics for the supplied referees or for referees assigned to a game. */
  compute(
    tournamentAllocationId: string,
    fragmentAllocationId: string,
    refereeAttendeeIds: string[] = [],
    gameId?: string,
  ): Observable<RefereeAllocationStatisticsResponse> {
    console.log('compute statistics', 'fragment', fragmentAllocationId, 'referees', refereeAttendeeIds, 'game', gameId);
    let params = new HttpParams()
      .set('tournamentAllocationId', tournamentAllocationId)
      .set('fragmentAllocationId', fragmentAllocationId);
    if (refereeAttendeeIds.length) params = params.set('refereeAttendeeIds', refereeAttendeeIds.join(','));
    if (gameId) params = params.set('gameId', gameId);
    const user = this.auth.currentUser;
    if (!user?.emailVerified) throw new Error('A verified account is required to compute statistics.');
    return from(user.getIdToken()).pipe(
      switchMap((token) =>
        this.http.get<RefereeAllocationStatisticsResponse>(
          `${environment.functionsApiUrl}/refereeAllocationStatistics/compute`,
          {
            params,
            headers: { Authorization: `Bearer ${token}` },
          },
        ),
      ),
    );
  }
}
