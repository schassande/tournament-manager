import { Injectable } from '@angular/core';
import { Person } from '@tournament-manager/persistent-data-model';
import { AbstractPersistentDataService, PersistentDataFilter } from './abstract-persistent-data.service';
import { Observable } from 'rxjs';
import { query, Query, where } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class PersonService extends AbstractPersistentDataService<Person>{

  protected override getCollectionName(): string { return 'person'; }

  byEmail(email: string): Observable<Person|null> {
    return this.queryOne(query(this.itemsCollection(), where('email', '==', email)));
  }

  search(searchCriteria: PersonSearchCriteria): Observable<Person[]> {
    const queryConstraints = []
    if (searchCriteria.regionId) {
      queryConstraints.push(where('regionId', '==', searchCriteria.regionId));
    }
    if (searchCriteria.countryId) {
      queryConstraints.push(where('countryId', '==', searchCriteria.countryId));
    }
    const result = this.query(query(this.itemsCollection(), ...queryConstraints));
    if (searchCriteria.keyword) {
      return super.filter(result, this.getFilterByText(searchCriteria.keyword));
    } else {
      return result;
    }
  }

  public getFilterByText(text: string): PersistentDataFilter<Person> {
    const validText = text && text !== null  && text.trim().length > 0 ? text.trim() : null;
    if (validText === null) {
      return () => false;
    } else {
      return (person: Person) => this.stringContains(validText, person.shortName)
          || this.stringContains(validText, person.firstName)
          || this.stringContains(validText, person.lastName);
    };
  }
}
export interface PersonSearchCriteria {
  regionId?: string;
  countryId?: string;
  keyword?: string;
}
