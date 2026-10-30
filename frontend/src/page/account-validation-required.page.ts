import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';

/** Explains that email verification is required before the new account can be used. */
@Component({
  selector: 'app-account-validation-required',
  imports: [ButtonModule, CardModule],
  templateUrl: './account-validation-required.page.html',
  styleUrl: './account-validation-required.page.css',
})
export class AccountValidationRequiredComponent {
  private readonly router = inject(Router);

  /** Returns the user to the login page after the verification email was sent. */
  goToLogin(): void {
    void this.router.navigateByUrl('/user/login');
  }
}
