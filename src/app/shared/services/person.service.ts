import { Injectable } from '@angular/core';
import { Person } from '../data.model';
import { AbstractPersistentDataService } from '../abstract-persistent-data.service';
import { Observable } from 'rxjs';
import { query, where } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class PersonService extends AbstractPersistentDataService<Person>{

  protected override getCollectionName(): string { return 'person'; }

  byEmail(email: string): Observable<Person|null> {
    return this.queryOne(query(this.itemsCollection(), where('email', '==', email)));
  }
}
