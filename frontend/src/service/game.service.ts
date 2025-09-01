import { Injectable } from '@angular/core';
import { AbstractPersistentDataService } from './abstract-persistent-data.service';
import { Game } from '../data.model';
import { Observable } from 'rxjs';
import { query, where } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class GameService extends AbstractPersistentDataService<Game>{

  protected override getCollectionName(): string { return 'game'; }

  byDay(tournamentId: string, dayId: string): Observable<Game[]> {
    return this.query(query(this.itemsCollection(), where('tournamentId', '==', tournamentId), where('dayId', '==', dayId)));
  }
}
