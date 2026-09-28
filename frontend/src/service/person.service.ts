import { inject, Injectable } from '@angular/core';
import { buildPersonSearch, normalizeIdentityEmail, Person } from '@tournament-manager/persistent-data-model';
import { AbstractPersistentDataService, PersistentDataFilter } from './abstract-persistent-data.service';
import { from, map, Observable } from 'rxjs';
import { query, Query, where } from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';

/** Verified self-registration payload. */
interface CreatePersonRequest {
  person: Person;
}

/** Persisted profile returned after registration-time attendee linking. */
type CreatePersonResponse = Person;

@Injectable({
  providedIn: 'root',
})
export class PersonService extends AbstractPersistentDataService<Person> {
  private functions = inject(Functions);

  /** Returns the persisted collection used by inherited read operations. */
  protected override getCollectionName(): string {
    return 'person';
  }

  /**
   * Persist a person.
   * New persons are created via the backend callable to enforce email uniqueness.
   * The denormalized search field is recomputed before every save.
   * Existing persons keep the current direct Firestore update flow.
   * @param item person to persist
   * @returns the persisted person
   */
  public override save(item: Person): Observable<Person> {
    const personToSave = this.prepareForSave(item);
    return personToSave.id ? super.save(personToSave) : this.createOnServer(personToSave);
  }

  /**
   * Create a person through the backend callable function.
   * @param person person to create
   * @returns the created persistent person
   */
  public createOnServer(person: Person): Observable<Person> {
    const callable = httpsCallable<CreatePersonRequest, CreatePersonResponse>(this.functions, 'createPerson', {
      timeout: 540000,
    });
    return from(callable({ person })).pipe(map((result) => result.data));
  }

  /** Deletes the account on the server, preserving tournament participants. */
  public override async delete(id: string): Promise<void> {
    await httpsCallable<{ personId: string; deleteAccount: true }, void>(
      this.functions,
      'deletePerson',
    )({
      personId: id,
      deleteAccount: true,
    });
  }

  /** Looks up a registered profile by its normalized immutable email. */
  byEmail(email: string): Observable<Person | null> {
    return this.queryOne(query(this.itemsCollection(), where('email', '==', normalizeIdentityEmail(email))));
  }

  /** Searches profiles using the supplied region, country, and text criteria. */
  search(searchCriteria: PersonSearchCriteria): Observable<Person[]> {
    const queryConstraints = [];
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

  /** Builds a case-insensitive identity search predicate. */
  public getFilterByText(text: string): PersistentDataFilter<Person> {
    const validText = text && text !== null && text.trim().length > 0 ? text.trim() : null;
    if (validText === null) {
      return () => false;
    } else {
      return (person: Person) =>
        this.stringContains(validText, person.search ?? '') ||
        this.stringContains(validText, person.shortName) ||
        this.stringContains(validText, person.firstName) ||
        this.stringContains(validText, person.lastName) ||
        this.stringContains(validText, person.email);
    }
  }

  /**
   * Recompute the denormalized search field before persisting a person.
   * @param person person being persisted
   * @returns a copy ready to save
   */
  private prepareForSave(person: Person): Person {
    return {
      ...person,
      search: buildPersonSearch(person),
    };
  }
}
/** Optional profile search filters. */
export interface PersonSearchCriteria {
  regionId?: string;
  countryId?: string;
  keyword?: string;
}
