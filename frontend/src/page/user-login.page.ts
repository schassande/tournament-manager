import { UserService } from '../service/user.service';
import { Component, inject, signal } from '@angular/core';
import { Person } from '@tournament-manager/persistent-data-model';
import { Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { browserLocalPersistence, browserSessionPersistence, setPersistence } from 'firebase/auth';

@Component({
  standalone: true,
  selector: 'app-user-login',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    CheckboxModule,
    CardModule,
    DividerModule,
  ],
  template: `
    <div class="login-panel">
      <p-card>
        <ng-template pTemplate="header">
          <div class="title">
            <i class="pi pi-lock"></i>
            <span>Login</span>
          </div>
        </ng-template>

        <form [formGroup]="form" (ngSubmit)="onSubmit()">
          <div class="form-row">
            <span class="form-label"><label for="email" class="font-medium">Email</label></span>
            <input
              pInputText
              id="email"
              type="email"
              formControlName="email"
              placeholder="ex: jean.dupont@mail.com"
              autocomplete="email"
            />
            <small class="p-error" *ngIf="submitted() && form.controls.email.invalid">
              {{ emailErrorMessage() }}
            </small>
          </div>

          <div class="form-row">
            <span class="form-label"><label for="password" class="font-medium">Password</label></span>
            <p-password
              inputId="password"
              formControlName="password"
              [feedback]="false"
              [toggleMask]="true"
              [inputStyle]="{ width: '100%' }"
              [inputStyleClass]="'w-full'"
              [placeholder]="'Password'"
              [autocomplete]="'current-password'"
            ></p-password>
            <small class="p-error" *ngIf="submitted() && form.controls.password.invalid">
              {{ passwordErrorMessage() }}
            </small>
          </div>

          <div class="form-row">
            <span class="remember">
              <p-checkbox inputId="remember" formControlName="remember"></p-checkbox>
              <label for="remember">Remember me</label>
            </span>
            <div class="forgotten-password"><a class="text-primary cursor-pointer" (click)="onForgotPassword()">Forgotten password?</a></div>
          </div>

          <div *ngIf="error()" class="error-message">
            <i class="pi pi-exclamation-triangle"></i>{{ error() }}
          </div>

          <div class="form-row">
            <button pButton type="submit" label="Login" class="login-button" [disabled]="loading()"></button>
          </div>
        </form>

        <ng-template pTemplate="footer">
          <div class="footer">
            <p-divider></p-divider>
            <span><a class="text-primary cursor-pointer" (click)="goToSignup()">Create an account</a></span>
          </div>
        </ng-template>
      </p-card>
    </div>
  `,
  styles: [`
    .login-panel { margin-top: 30px; width: 100%; display: flex; justify-content: center; }
    .login-panel p-card {
      margin-top: 20px;
      width: 100%;
      max-width: 28rem;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,.1), 0 4px 6px -4px rgba(0,0,0,.1);
    }
    .title { text-align: center; margin-top: 20px; font-size: 1.5rem;}
    .title i { margin-right: 10px; font-size: 2rem;  }
    .form-row{ margin-top: 10px; }
    .form-row p-password, .form-row input { width: 250px; }
    .form-label{ width: 100px; display: inline-block; }
    .remember label { margin-left: 10px; display: inline-block; }
    .forgotten-password { float: right; display: inline-block; }
    .error-message { padding: .5rem; border-radius: 0.75rem; }
    .login-button { width: 100%; margin-top: 10px; }
    .footer { text-align: center; color: var(--text-color-secondary, #6b7280); }
    .p-error { color: var(--red-600, #dc2626); }

    .text-primary { color: var(--primary-color, #3b82f6); }
    .cursor-pointer { cursor: pointer; }
  `],
})
export class UserLoginComponent {

  userService = inject(UserService);
  router = inject(Router);
  private fb = inject(FormBuilder);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    remember: [true],
  });

  // Signals pour l'état UI
  loading = signal(false);
  error = signal<string | null>(null);
  submitted = signal(false);

  async onSubmit() {
    this.submitted.set(true);
    this.error.set(null);

    if (this.form.invalid) return;

    const { email, password, remember } = this.form.getRawValue();

    try {
      this.loading.set(true);

      this.userService.login(email!, password!).subscribe((user:Person|null) => {
        this.loading.set(false);
        if (user) {
          console.log(user);
          this.router.navigate(['/home']);
        } else {
          // TODO this.error.set(this.mapFirebaseError(e?.code) ?? 'Échec de la connexion.');
        }
      });
      // Optionnel : persistance selon "remember me"
      // await setPersistence(this.auth, remember ? browserLocalPersistence : browserSessionPersistence);

    } catch (e: any) {
      this.error.set(this.mapFirebaseError(e?.code) ?? 'Échec de la connexion.');
    } finally {
      this.loading.set(false);
    }
  }

  onForgotPassword() {
    // Place-holder : ici tu peux ouvrir un dialog, ou router vers /reset-password
    // Exemple : this.router?.navigate(['/reset-password'], { queryParams: { email: this.form.value.email } });
    this.error.set('Lien "Mot de passe oublié" non implémenté.');
  }

  goToSignup() {
    // Redirige vers une page d'inscription si disponible
    this.router?.navigateByUrl('/signup');
  }

  emailErrorMessage() {
    const c = this.form.controls.email;
    if (c.hasError('required')) return 'L\'email est requis.';
    if (c.hasError('email')) return 'Format d\'email invalide.';
    return '';
  }

  passwordErrorMessage() {
    const c = this.form.controls.password;
    if (c.hasError('required')) return 'Password is required.';
    if (c.hasError('minlength')) return 'Password is too short. 6 characters are required.';
    return '';
  }

  private mapFirebaseError(code?: string): string | null {
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Ivalid email or password.';
      case 'auth/too-many-requests':
        return 'Too many requests. Try again later.';
      case 'auth/network-request-failed':
        return 'Network problem. Check your connection.';
      default:
        return null;
    }
  }
}
