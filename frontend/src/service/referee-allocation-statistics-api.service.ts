import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
import {
  FragmentRefereeAllocationStatistics,
  TournamentRefereeAllocationStatistics,
} from '@tournament-manager/persistent-data-model';

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
    return this.http.get<RefereeAllocationStatisticsResponse>(
      `${environment.functionsApiUrl}/refereeAllocationStatistics/compute`, { params });
  }
}
