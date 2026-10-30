import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { RadioButtonModule } from 'primeng/radiobutton';
import { SelectModule } from 'primeng/select';
import { Country, Gender, Person } from '@tournament-manager/persistent-data-model';
import { RegionService } from '../service/region.service';
import { UserService } from '../service/user.service';

type RegistrationMode = 'google' | 'password';

/** Provides the responsive self-registration form for Google and email/password accounts. */
@Component({
  selector: 'app-user-create',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    CardModule,
    InputTextModule,
    RadioButtonModule,
    SelectModule,
  ],
  templateUrl: './user-create.page.html',
  styleUrl: './user-create.page.css',
})
export default class UserCreateComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router, { optional: true });
  private readonly regionService = inject(RegionService);
  private readonly userService = inject(UserService);

  readonly countries: Country[] = this.regionService.countries;
  readonly mode = signal<RegistrationMode>('password');
  readonly loading = signal(false);
  readonly googleAuthenticated = signal(false);
  readonly error = signal<string | null>(null);
  country: Country | undefined;

  readonly form = this.formBuilder.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(3)]],
    country: [null as Country | null, Validators.required],
    gender: ['M', Validators.required],
    shortName: [''],
  });

  private readonly countrySuggestion = effect(() => {
    if (this.regionService.countriesLoaded() && !this.country) {
      const language = typeof navigator === 'undefined' ? '' : navigator.language;
      const regionCode = language.split('-')[1]?.toUpperCase();
      const countryName = new Intl.DisplayNames([language], { type: 'region' }).of(regionCode)?.toLowerCase();
      const c = this.countries.find((country) => country.name.toLowerCase() === countryName) ?? undefined;
      console.log('effect auto set country', countryName, c);
      this.setCountry(c);
    }
  });

  /** Selects a registration mode and resets transient state. */
  selectMode(mode: RegistrationMode): void {
    this.mode.set(mode);
    this.error.set(null);
    if (mode === 'password') {
      this.googleAuthenticated.set(false);
      this.form.controls.email.enable();
      this.form.controls.password.enable();
      this.form.controls.firstName.enable();
      this.form.controls.lastName.enable();
    } else {
      this.googleAuthenticated.set(false);
      this.form.patchValue({ firstName: '', lastName: '', email: '' });
      this.form.controls.firstName.disable();
      this.form.controls.lastName.disable();
      this.form.controls.email.disable();
      this.form.controls.password.disable();
    }
  }

  /** Keeps the PrimeNG country selection and the reactive form value synchronized. */
  countryChanged(country: Country | undefined): void {
    this.setCountry(country);
  }

  /** Stores the selected country in both component state and the form. */
  private setCountry(country: Country | undefined): void {
    this.country = country;
    this.form.controls.country.setValue(country ?? null);
  }

  /** Authenticates with Google and prefills the identity fields. */
  async authenticateWithGoogle(): Promise<void> {
    this.error.set(null);
    this.loading.set(true);
    try {
      const user = await firstValueFrom(this.userService.startGoogleRegistration());
      const [firstName = 'User', ...lastNameParts] = (user.displayName ?? 'User').trim().split(/\s+/);
      this.form.patchValue({
        firstName,
        lastName: lastNameParts.join(' ') || firstName,
        email: user.email ?? '',
      });
      this.form.controls.firstName.disable();
      this.form.controls.lastName.disable();
      this.form.controls.email.disable();
      this.form.controls.password.disable();
      this.googleAuthenticated.set(true);
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : 'Google authentication failed.');
    } finally {
      this.loading.set(false);
    }
  }

  /** Validates and submits the selected registration workflow. */
  async onSubmit(): Promise<void> {
    this.error.set(null);
    if (this.mode() === 'google' && !this.googleAuthenticated()) {
      await this.authenticateWithGoogle();
    }
    if (this.form.invalid || (this.mode() === 'google' && !this.googleAuthenticated())) {
      this.form.markAllAsTouched();
      this.error.set('Please complete the required fields.');
      return;
    }

    this.loading.set(true);
    try {
      const values = this.form.getRawValue();
      const person = this.toPerson(values);
      const created =
        this.mode() === 'google'
          ? await firstValueFrom(this.userService.createGoogleUser(person))
          : await firstValueFrom(this.userService.createUser(person, values.password!));
      await this.router?.navigateByUrl(created ? '/' : '/user/account-validation-required');
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : 'Error during user creation.');
    } finally {
      this.loading.set(false);
    }
  }

  /** Maps validated form values to the existing Person contract. */
  private toPerson(values: ReturnType<typeof this.form.getRawValue>): Person {
    const firstName = values.firstName!.trim();
    const lastName = values.lastName!.trim();
    const country = values.country!;
    return {
      id: '',
      lastChange: Date.now(),
      userAuthId: values.email!,
      firstName,
      lastName,
      shortName: values.shortName?.trim() || `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase(),
      email: values.email!.trim(),
      countryId: country?.id,
      regionId: this.regionService.regionByCountryId(country?.id)?.id ?? '',
      gender: (values.gender ?? 'M') as Gender,
    };
  }
}
