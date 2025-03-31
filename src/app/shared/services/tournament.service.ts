import { Injectable, signal } from '@angular/core';
import { Tournament } from '../data.model';
import { AbstractPersistentDataService } from '../abstract-persistent-data.service';

@Injectable({
  providedIn: 'root'
})
export class TournamentService extends AbstractPersistentDataService<Tournament>{

  /** Signal containing the current selected tournament. Null means no current tournament is selected. */
  public currentTournament$ = signal<Tournament|null>(null);

  protected override getCollectionName(): string { return 'tournament'; }
}
