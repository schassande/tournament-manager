import { colFitData } from '@tournament-manager/persistent-data-model';
import { Injectable } from '@angular/core';
import { orderBy, query, where } from '@angular/fire/firestore';
import { map, Observable } from 'rxjs';
import { AbstractPersistentDataService } from './abstract-persistent-data.service';
import { FITData } from './fit-import.service';

/** Provides persistence and retrieval of FIT import snapshots. */
@Injectable({ providedIn: 'root' })
export class FitDataService extends AbstractPersistentDataService<FITData> {
  protected override getCollectionName(): string {
    return colFitData;
  }

  /** Loads the most recent FIT snapshot belonging to a tournament. */
  public latestForTournament(
    tournamentId: string,
  ): Observable<FITData | undefined> {
    return this.forTournament(tournamentId).pipe(
      map((snapshots) => snapshots[0]),
    );
  }

  /** Loads all FIT snapshots belonging to a tournament, newest first. */
  public forTournament(tournamentId: string): Observable<FITData[]> {
    const latest = query(
      this.itemsCollection(),
      where('tournamentId', '==', tournamentId),
      orderBy('importDate', 'desc'),
    );
    return this.query(latest);
  }
}
