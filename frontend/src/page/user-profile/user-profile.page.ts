import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { firstValueFrom } from 'rxjs';
import { Person } from '@tournament-manager/persistent-data-model';
import { PersonService } from '../../service/person.service';
import { UserService } from '../../service/user.service';

/** Profile editing and explicit account deletion, authorized by the server and Firestore rules. */
@Component({
  selector: 'app-user-profile',
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="p-4">
      <h1>User profile</h1>
      @if (person()) {
        <p>Email: {{ person()!.email }}</p>
        <form [formGroup]="form" (ngSubmit)="save()">
          <p>
            <label>First name <input pInputText formControlName="firstName" /></label>
          </p>
          <p>
            <label>Last name <input pInputText formControlName="lastName" /></label>
          </p>
          <p>
            <label>Short name <input pInputText formControlName="shortName" /></label>
          </p>
          <p>
            <label>Phone <input pInputText formControlName="phone" /></label>
          </p>
          <button pButton type="submit" [disabled]="busy() || form.invalid">Save profile</button>
        </form>
        <h2>Delete account</h2>
        <p>This deletes the account. Tournament participation records remain unchanged.</p>
        <label
          ><input
            type="checkbox"
            [checked]="confirmDeletion()"
            (change)="confirmDeletion.set($any($event.target).checked)" />
          I confirm account deletion</label
        >
        <p>
          <button
            pButton
            type="button"
            severity="danger"
            [disabled]="busy() || !confirmDeletion()"
            (click)="deleteAccount()">
            Delete account
          </button>
        </p>
      }
      @if (message()) {
        <p role="status">{{ message() }}</p>
      }
    </main>
  `,
})
export class UserProfilePage {
  private readonly people = inject(PersonService);
  private readonly users = inject(UserService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly builder = inject(FormBuilder);
  readonly person = signal<Person | undefined>(undefined);
  readonly busy = signal(false);
  readonly confirmDeletion = signal(false);
  readonly message = signal('');
  readonly form = this.builder.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    shortName: [''],
    phone: [''],
  });

  /** Loads the selected profile; subsequent mutations remain subject to owner/admin checks. */
  constructor() {
    this.people
      .byId(this.route.snapshot.paramMap.get('id') || '')
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (person) => {
          this.person.set(person);
          if (person) this.form.patchValue({ ...person, phone: person.phone || '' });
          else this.message.set('Profile not found.');
        },
        error: () => this.message.set('Unable to load this profile.'),
      });
  }

  /** Saves editable profile fields, retaining immutable email and authentication ownership. */
  async save(): Promise<void> {
    const person = this.person();
    if (!person || this.form.invalid) return;
    this.busy.set(true);
    try {
      const saved = await firstValueFrom(this.people.save({ ...person, ...this.form.getRawValue() }));
      if (this.users.currentUser$()?.id === saved.id) this.users.currentUser$.set(saved);
      this.message.set('Profile saved.');
    } catch {
      this.message.set('Unable to save. Only the account owner or a platform administrator may edit this profile.');
    } finally {
      this.busy.set(false);
    }
  }

  /** Invokes account deletion only after explicit confirmation in this page. */
  async deleteAccount(): Promise<void> {
    const person = this.person();
    if (!person || !this.confirmDeletion()) return;
    this.busy.set(true);
    try {
      await this.people.delete(person.id);
      if (this.users.currentUser$()?.id === person.id) this.users.logout();
      await this.router.navigateByUrl('/home');
    } catch {
      this.message.set('Account deletion failed. Check your permissions and retry.');
    } finally {
      this.busy.set(false);
    }
  }
}
