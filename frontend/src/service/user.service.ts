import { inject, Injectable, signal } from '@angular/core';
import { Person } from '@tournament-manager/persistent-data-model';
import { catchError, from, map, mergeMap, Observable, of, switchMap, tap, throwError } from 'rxjs';
import { Auth, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup, signOut, UserCredential } from '@angular/fire/auth';
import { PersonService } from './person.service';
import { UserLocalStorageService } from './user-local-storage.service';
import { toObservable } from '@angular/core/rxjs-interop';


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
        // console.debug('User connected', user);
        return user;
      }),
      catchError((err) => {
        console.error('Authentification failed', err);
        throw err;
      })
    )
  }

  /**
   * Authenticate the user with Google and create the matching Person when needed.
   * Google authentication deliberately does not use the email/password local persistence.
   * @returns the authenticated or newly created person
   */
  public loginWithGoogle(): Observable<Person|null> {
    const provider = new GoogleAuthProvider();

    return from(signInWithPopup(this.authService, provider)).pipe(
      switchMap((credential: UserCredential) => {
        this.currentCredential = credential;
        const googleUser = credential.user;
        const email = googleUser.email?.trim();
        if (!email) {
          return throwError(() => new Error('Google authentication did not provide an email address.'));
        }

        return this.personService.byEmail(email).pipe(
          switchMap((person) => person
            ? of(person)
            : this.personService.createOnServer(this.personFromGoogle(googleUser, email))
          ),
          tap((person) => this.currentUser$.set(person))
        );
      }),
      catchError((err) => {
        console.error('Google authentication failed', {
          code: err?.code,
          message: err?.message,
          name: err?.name,
          error: err,
        });
        return throwError(() => err);
      })
    );
  }
  public logout() {
    this.currentUser$.set(null);
    this.clearLegacyCredentials();
    signOut(this.authService);
  }

  /**
   * Restore the Firebase session and load its matching application user.
   *
   * Firebase restores its persisted session asynchronously after a page reload.
   * Waiting for `authStateReady` avoids attempting a second password login while
   * that restoration is still in progress.
   * @returns the connected person, or null when no Firebase session exists
   */
  public autoLogin(): Observable<Person|null> {
    return from(this.authService.authStateReady()).pipe(
      switchMap(() => {
        const firebaseUser = this.authService.currentUser;
        if (!firebaseUser?.email) {
          console.debug('No Firebase session to restore');
          return of(null);
        }

        return this.personService.byEmail(firebaseUser.email).pipe(
          tap((person) => this.currentUser$.set(person))
        );
      }),
      tap(() => this.clearLegacyCredentials()),
    );
  }

  public createUser(user: Person, password: string): Observable<Person> {
    return from(createUserWithEmailAndPassword(this.authService, user.email, password)).pipe(
      switchMap((userCred: UserCredential) => {
        user.userAuthId = userCred.user.uid;
        return this.personService.createOnServer(user).pipe(
          tap((createdPerson) => {
            this.currentCredential = userCred;
            this.currentUser$.set(createdPerson);
          }),
          catchError((err) => from(userCred.user.delete()).pipe(
            switchMap(() => throwError(() => err))
          ))
        );
      })
    )
  }

  public setLocalUserProperty(key:string, value:any){
    this.userLocalStorageService.setUserProperty(this.getUserKey(key), value);
  }
  public getLocalUserProperty(key:string): any{
    return this.userLocalStorageService.getUserProperty(this.getUserKey(key));
  }

  /** Remove credentials written by versions that implemented password autologin. */
  private clearLegacyCredentials(): void {
    this.userLocalStorageService.removeUserProperty('DEFAULT_USER_EMAIL');
    this.userLocalStorageService.removeUserProperty('DEFAULT_USER_PASSWORD');
  }

  private getUserKey(key: string): string {
    const user = this.currentUser$();
    return (user && user.id ? user.id +'.' : '') + key;
  }

  /**
   * Map the Firebase Google profile to the minimum valid Person payload.
   * @param user authenticated Firebase user
   * @param email normalized email address
   * @returns person payload ready for the createPerson callable
   */
  private personFromGoogle(user: UserCredential['user'], email: string): Person {
    const [firstName = 'Google', ...lastNameParts] = (user.displayName ?? 'User').trim().split(/\s+/);
    const lastName = lastNameParts.join(' ') || firstName;
    const shortName = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

    return {
      id: '',
      lastChange: 0,
      userAuthId: user.uid,
      firstName,
      lastName,
      shortName,
      email,
      regionId: 'Europe',
      countryId: 'FRA',
      photoUrl: user.photoURL ?? undefined,
    };
  }
}
