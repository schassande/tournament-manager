import { inject, Injectable, signal } from '@angular/core';
import { normalizeIdentityEmail, Person } from '@tournament-manager/persistent-data-model';
import { from, Observable, of, switchMap, tap } from 'rxjs';
import {
  Auth,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendEmailVerification,
  reload,
  updateProfile,
  User,
  UserCredential,
} from '@angular/fire/auth';
import { PersonService } from './person.service';
import { UserLocalStorageService } from './user-local-storage.service';
import { toObservable } from '@angular/core/rxjs-interop';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  authService = inject(Auth);
  personService = inject(PersonService);
  userLocalStorageService = inject(UserLocalStorageService);
  currentCredential?: UserCredential;

  /** Signal containing the current connected user. Null means no user is connected. */
  public readonly currentUser$ = signal<Person | null>(null);
  public readonly currentUser$$ = toObservable(this.currentUser$);
  /** Reports whether a verified application profile has completed login. */
  public isConnected() {
    return this.currentUser$() !== null;
  }
  /** Signs in only a verified identity, completing or resuming its profile linkage. */
  public login(email: string, password: string): Observable<Person | null> {
    return from(signInWithEmailAndPassword(this.authService, email, password)).pipe(
      switchMap((credential) => {
        this.currentCredential = credential;
        return this.finishLogin(credential.user);
      }),
    );
  }

  /** Uses the same verified-registration workflow for Google authentication. */
  public loginWithGoogle(): Observable<Person | null> {
    return from(signInWithPopup(this.authService, new GoogleAuthProvider())).pipe(
      switchMap((credential) => {
        this.currentCredential = credential;
        return this.finishLogin(credential.user);
      }),
    );
  }

  /** Clears the application profile and signs out the Firebase session. */
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
  public autoLogin(): Observable<Person | null> {
    return from(this.authService.authStateReady()).pipe(
      switchMap(() => {
        const user = this.authService.currentUser;
        if (!user?.emailVerified) {
          this.currentUser$.set(null);
          return of(null);
        }
        return this.finishLogin(user);
      }),
      tap(() => this.clearLegacyCredentials()),
    );
  }

  /** Starts verification, or completes registration after the user follows the email link. */
  public createUser(user: Person, password: string): Observable<Person | null> {
    return from(this.prepareRegistration(user, password)).pipe(
      switchMap((authUser) => (authUser.emailVerified ? this.finishLogin(authUser) : of(null))),
    );
  }

  /** Deletes the current application account and clears the local session after completion. */
  public async deleteAccount(): Promise<void> {
    const user = this.currentUser$();
    if (!user) throw new Error('Sign in before deleting your account.');
    await this.personService.delete(user.id);
    this.logout();
  }

  /** Persists only draft profile fields locally; passwords are never retained. */
  private async prepareRegistration(person: Person, password: string): Promise<User> {
    let authUser = this.authService.currentUser;
    if (!authUser || normalizeIdentityEmail(authUser.email || '') !== normalizeIdentityEmail(person.email)) {
      try {
        authUser = (await createUserWithEmailAndPassword(this.authService, person.email, password)).user;
      } catch (error: unknown) {
        if ((error as { code?: string }).code !== 'auth/email-already-in-use') throw error;
        authUser = (await signInWithEmailAndPassword(this.authService, person.email, password)).user;
      }
    }
    await reload(authUser);
    sessionStorage.setItem(
      `registration:${authUser.uid}`,
      JSON.stringify({
        ...person,
        userAuthId: authUser.uid,
        email: normalizeIdentityEmail(authUser.email || ''),
      }),
    );
    if (!authUser.emailVerified) {
      await updateProfile(authUser, { displayName: `${person.firstName} ${person.lastName}` });
      await sendEmailVerification(authUser);
      this.currentUser$.set(null);
    }
    return authUser;
  }

  /** Rejects unverified sessions and retries the idempotent server registration/linking action. */
  private finishLogin(user: User): Observable<Person> {
    return from(this.requireVerifiedUser(user)).pipe(
      switchMap(() => this.personService.byEmail(user.email!)),
      switchMap((existing) => {
        if (existing && existing.userAuthId !== user.uid) {
          throw new Error('The account identity does not match this profile.');
        }
        const draft = sessionStorage.getItem(`registration:${user.uid}`);
        const person = existing || (draft ? (JSON.parse(draft) as Person) : this.personFromGoogle(user, user.email!));
        return this.personService.createOnServer({
          ...person,
          userAuthId: user.uid,
          email: normalizeIdentityEmail(user.email!),
        });
      }),
      tap((person) => {
        sessionStorage.removeItem(`registration:${user.uid}`);
        this.currentUser$.set(person);
      }),
    );
  }

  /** Refreshes token claims after verification and blocks access until ownership is established. */
  private async requireVerifiedUser(user: User): Promise<void> {
    this.currentUser$.set(null);
    await reload(user);
    if (!user.email || !user.emailVerified) {
      throw Object.assign(new Error('Validate your email before signing in.'), { code: 'auth/email-not-verified' });
    }
    await user.getIdToken(true);
  }

  /** Stores a user-scoped local preference. */
  public setLocalUserProperty(key: string, value: any) {
    this.userLocalStorageService.setUserProperty(this.getUserKey(key), value);
  }
  /** Reads a user-scoped local preference. */
  public getLocalUserProperty(key: string): any {
    return this.userLocalStorageService.getUserProperty(this.getUserKey(key));
  }

  /** Remove credentials written by versions that implemented password autologin. */
  private clearLegacyCredentials(): void {
    this.userLocalStorageService.removeUserProperty('DEFAULT_USER_EMAIL');
    this.userLocalStorageService.removeUserProperty('DEFAULT_USER_PASSWORD');
  }

  /** Namespaces local preferences by the active profile. */
  private getUserKey(key: string): string {
    const user = this.currentUser$();
    return (user && user.id ? user.id + '.' : '') + key;
  }

  /**
   * Map the Firebase Google profile to the minimum valid Person payload.
   * @param user authenticated Firebase user
   * @param email normalized email address
   * @returns person payload ready for the createPerson callable
   */
  private personFromGoogle(user: UserCredential['user'], email: string): Person {
    const [firstName = 'User', ...lastNameParts] = (user.displayName ?? 'User').trim().split(/\s+/);
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
