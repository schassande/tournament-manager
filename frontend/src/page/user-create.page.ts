import { UserService } from '../service/user.service';
import { from, map, mergeMap, Observable } from 'rxjs';
import { RegionService } from '../service/region.service';
import { Country, Person, Region } from '../data.model';
import { Auth, createUserWithEmailAndPassword, UserCredential } from '@angular/fire/auth';
import { PersonService } from '../service/person.service';


import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { InputTextModule } from 'primeng/inputtext';
import { ListboxModule } from 'primeng/listbox';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { RadioButtonModule } from 'primeng/radiobutton';

@Component({
  selector: 'app-user-create',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    InputTextModule,
    ListboxModule,
    ButtonModule,
    CardModule,
    DividerModule,
    RadioButtonModule
  ],
  template: `
    <div class="min-h-screen flex justify-center items-center bg-surface-50 p-4">
      <p-card class="w-full max-w-2xl shadow-2">
        <ng-template pTemplate="header">
          <div class="flex items-center gap-2">
            <i class="pi pi-user-plus text-xl"></i>
            <span class="text-lg font-semibold">Créer un utilisateur</span>
          </div>
        </ng-template>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-4">

          <div>
            <label class="font-medium">Photo (URL)</label>
            <input pInputText formControlName="photoUrl" placeholder="https://exemple.com/photo.jpg" class="w-full" />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="font-medium">First Name</label>
              <input pInputText formControlName="firstName" placeholder="Prénom" class="w-full" />
            </div>
            <div>
              <label class="font-medium">Last Name</label>
              <input pInputText formControlName="lastName" placeholder="Nom" class="w-full" />
            </div>
          </div>

          <!-- Surnom -->
          <div>
            <label class="font-medium">Short name</label>
            <input pInputText formControlName="shortName" placeholder="Surnom ou nom d'affichage" class="w-full" />
          </div>

          <!-- Email -->
          <div>
            <label class="font-medium">Email</label>
            <input pInputText type="email" formControlName="email" placeholder="ex: user@mail.com" class="w-full" />
          </div>

          <div>
            <label class="font-medium">Pasword</label>
            <input pInputText type="password" formControlName="password" class="w-full" />
          </div>

          <!-- Country -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="font-medium">Country</label>
              <p-listbox
                [options]="countries"
                optionLabel="name"
                optionValue="id"
                formControlName="countryId"
                placeholder="Selection country">
                [disabled]="!form.value.regionId">
              </p-listbox>
            </div>
          </div>

          <!-- Gender -->
          <div>
            <label class="font-medium">Genre</label>
            <div class="flex gap-4 mt-2">
              <div class="flex items-center gap-2">
                <p-radioButton name="gender" value="M" formControlName="gender"></p-radioButton>
                <label>Male</label>
              </div>
              <div class="flex items-center gap-2">
                <p-radioButton name="gender" value="F" formControlName="gender"></p-radioButton>
                <label>Female</label>
              </div>
            </div>
          </div>

          <!-- Erreur -->
          @if(error()) {
          <div  class="p-2 border-round bg-red-50 text-red-700 border-1 border-red-200">
            <i class="pi pi-exclamation-triangle mr-2"></i>{{ error() }}
          </div>
          }
          <button pButton type="submit" label="Créer l'utilisateur" class="w-full" [disabled]="loading()"></button>
        </form>

      </p-card>
    </div>
  `,
  styles: [`
    .min-h-screen { min-height: 100vh; }
    .bg-surface-50 { background: var(--surface-50, #f8f9fa); }
    .border-round { border-radius: 0.75rem; }
    .w-full { width: 100%; }
    .max-w-2xl { max-width: 42rem; }
    .shadow-2 { box-shadow: 0 10px 15px -3px rgba(0,0,0,.1), 0 4px 6px -4px rgba(0,0,0,.1); }
    .font-medium { font-weight: 500; }
    .text-lg { font-size: 1.125rem; }
    .text-xl { font-size: 1.25rem; }
    .font-semibold { font-weight: 600; }
    .gap-2 { gap: .5rem; }
    .gap-4 { gap: 1rem; }
    .p-2 { padding: .5rem; }
    .mr-2 { margin-right: .5rem; }
    .flex { display: flex; }
    .items-center { align-items: center; }
    .justify-center { justify-content: center; }
    .grid { display: grid; }
    .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
    .md\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .p-error { color: var(--red-600, #dc2626); }
  `]
})
export default class UserCreateComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router, { optional: true });
  private regionService = inject(RegionService);
  private userService = inject(UserService);

  loading = signal(false);
  error = signal<string | null>(null);

  // Exemple de données (à remplacer par API ou Firestore)
  countries: Country[] = this.regionService.countries;

  form = this.fb.group({
    photoUrl: [''],
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    shortName: [''],
    password: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    countryId: [null, Validators.required],
    gender: [null, Validators.required],
  });

  async onSubmit() {
    this.error.set(null);
    if (this.form.invalid) {
      this.error.set('Reuiqred field are missing.');
      return;
    }
    try {
      this.loading.set(true);
      const newUser = this.form.getRawValue();
      if (!newUser || !newUser.firstName || !newUser.lastName  || !newUser.email || !newUser.password || !newUser.countryId ) {
        console.error('Champ(s) incomplet(s)');
        return;
      }
      const user: Person = {
        firstName: newUser.firstName.trim(),
        lastName: newUser.lastName.trim(),
        shortName: newUser.shortName?.trim() || `${newUser.firstName.trim().charAt(0)}${newUser.lastName.trim().charAt(0)}${newUser.lastName.trim().charAt(newUser.lastName.trim().length-1)}`.toUpperCase(),
        email: newUser.email.trim(),
        countryId: newUser.countryId,
        photoUrl: newUser.photoUrl?.trim(),
        userAuthId: newUser.email,
        id:'',
        lastChange: new Date().getTime(),
        regionId: this.regionService.regionByCountryId(newUser.countryId)!.id,
      };

      this.userService.createUser(user, newUser.password).subscribe();

      this.router?.navigateByUrl('/');
    } catch (e) {
      this.error.set('Error during user creation.');
    } finally {
      this.loading.set(false);
    }
  }
}
