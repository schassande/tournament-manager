import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
import { Tournament } from '@tournament-manager/persistent-data-model';

export interface TournamentHomeResponse {
  tournament: Pick<Tournament, 'id' | 'name' | 'description' | 'startDate' | 'endDate' | 'venue' | 'city' | 'countryId' | 'timeZone' | 'allowPlayerReferees' | 'enablesModules'> & {
    days: Tournament['days']; fields: Tournament['fields']; divisions: Tournament['divisions'];
  };
  refereeCount: number; fullTimeRefereeCount: number; playerRefereeCount: number; playerRefereePercentage: number;
  pyramid: Array<{ level: number; male: { total: number; upgrade: number }; female: { total: number; upgrade: number } }>;
  gameCount: number; nbGamesAllocated: number; nbGamesToAllocate: number;
}

/** Loads the anonymized public overview for one tournament. */
@Injectable({ providedIn: 'root' })
export class TournamentHomeService {
  private readonly http = inject(HttpClient);

  /** @param tournamentId public tournament identifier */
  public byTournament(tournamentId: string): Observable<TournamentHomeResponse> {
    return this.http.get<TournamentHomeResponse>(`${environment.functionsApiUrl}/tournamentHome`, { params: { tournamentId } });
  }
}
