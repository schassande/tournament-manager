import { inject, Injectable } from '@angular/core';
import { Person } from '@tournament-manager/persistent-data-model';
import { AbstractPersistentDataService, PersistentDataFilter } from './abstract-persistent-data.service';
import { from, map, Observable } from 'rxjs';
import { query, Query, where } from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';

interface CreatePersonRequest {
  person: Person;
}

type CreatePersonResponse = Person;

@Injectable({
  providedIn: 'root'
})
export class PersonService extends AbstractPersistentDataService<Person>{
  private functions = inject(Functions);

  protected override getCollectionName(): string { return 'person'; }

  /**
   * Persist a person.
   * New persons are created via the backend callable to enforce email uniqueness.
   * Existing persons keep the current direct Firestore update flow.
   * @param item person to persist
   * @returns the persisted person
   */
  public override save(item: Person): Observable<Person> {
    return item.id ? super.save(item) : this.createOnServer(item);
  }

  /**
   * Create a person through the backend callable function.
   * @param person person to create
   * @returns the created persistent person
   */
  public createOnServer(person: Person): Observable<Person> {
    const callable = httpsCallable<CreatePersonRequest, CreatePersonResponse>(this.functions, 'createPerson');
    return from(callable({person})).pipe(
      map((result) => result.data)
    );
  }

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
