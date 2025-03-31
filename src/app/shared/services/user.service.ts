import { computed, inject, Injectable, signal, Signal } from '@angular/core';
import { Person } from '../data.model';
import { BehaviorSubject, catchError, from, map, mergeMap, Observable, of, ReplaySubject, Subject } from 'rxjs';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, UserCredential } from 'firebase/auth';
import { PersonService } from './person.service';
import { Auth } from '@angular/fire/auth';
import { UserLocalStorageService } from './user-local-storage.service';
import { toObservable } from '@angular/core/rxjs-interop';


const KEY_DEFAULT_USER_EMAIL = 'DEFAULT_USER_EMAIL';
const KEY_DEFAULT_USER_PASSWORD = 'DEFAULT_USER_PASSWORD';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  authService = inject(Auth);
  personService = inject(PersonService);
  userLocalStorageService = inject(UserLocalStorageService);
  currentCredential?: UserCredential;

  /** Signal containing the current connected user. Null means no user is connected. */
  public readonly currentUser$ = signal<Person|null>(null);
  public readonly currentUser$$ = toObservable(this.currentUser$);
  public isConnected() {
    return this.currentUser$() !== null;
  }
  public login(email: string, password: string):Observable<Person|null> {
    return from(signInWithEmailAndPassword(this.authService, email, password)).pipe(
      map((cred: UserCredential) => {
        if (cred.user) {
          // console.log('Connected', JSON.stringify(cred, null, 2))
          this.currentCredential = cred;
        } else {
          console.error('Authentification failed');
        }
      }),
      mergeMap(() => this.personService.byEmail(email)),
      map((user:Person|null) => {
        this.currentUser$.set(user);
        this.setLastUser(email, password);
        console.debug('User connected', user);
        return user;
      }),
      catchError((err) => {
        console.error('Authentification failed', err);
        throw err;
      })
    )
  }
  public logout() {
    signOut(this.authService);
    this.currentUser$.set(null);
  }
  public autoLogin(): Observable<Person|null> {
    const {email, password } = this.getLastUser();
    if (email && password) {
      console.debug('Autologin...');
      return this.login(email, password)
    } else {
      console.debug('No autologin', email, password);
      return of(null);
    }
  }

  public createUser(user: Person, password: string): Observable<Person> {
    return from(createUserWithEmailAndPassword(this.authService, user.email, password)).pipe(
      map((userCred: UserCredential) => {
        if (userCred.user.email) {
          user.userAuthId = userCred.user.email
        }
      }),
      mergeMap(() => this.personService.save(user)),
      map(() => this.setLastUser(user.email, password)),
      // auto login after account creation
      mergeMap(() => this.login(user.email, password)),
      map(() => user)
    )
  }

  public setLastUser(email:string, password:string) {
    this.userLocalStorageService.setUserProperty(KEY_DEFAULT_USER_EMAIL, email);
    this.userLocalStorageService.setUserProperty(KEY_DEFAULT_USER_PASSWORD, password);
  }

  public getLastUser(): {email:string, password:string} {
    return {
      email: this.userLocalStorageService.getUserProperty(KEY_DEFAULT_USER_EMAIL),
      password: this.userLocalStorageService.getUserProperty(KEY_DEFAULT_USER_PASSWORD)
    };
  }

  public setLocalUserProperty(key:string, value:any){
    this.userLocalStorageService.setUserProperty(this.getUserKey(key), value);
  }
  public getLocalUserProperty(key:string): any{
    this.userLocalStorageService.getUserProperty(this.getUserKey(key));
  }

  private getUserKey(key: string): string {
    const user = this.currentUser$();
    return (user && user.id ? user.id +'.' : '') + key;
  }
}
