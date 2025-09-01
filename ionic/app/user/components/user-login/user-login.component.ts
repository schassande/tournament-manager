import { UserService } from 'src/app/shared/services/user.service';
import { Component, inject, OnInit } from '@angular/core';
import { Person } from 'src/app/shared/data.model';
import { Router } from '@angular/router';

@Component({
  standalone: false,
  selector: 'app-user-login',
  templateUrl: './user-login.component.html',
  styleUrls: ['./user-login.component.scss'],
})
export class UserLoginComponent {

  userService = inject(UserService);
  router = inject(Router);

  email: string = '';
  password: string = '';
  savePassword = true;
  errors: any[] = [];

  login() {
    this.userService.login(this.email, this.password).subscribe((user:Person|null) => {
      if (user) {
        console.log(user);
        this.router.navigate(['/home']);
      } else {
        this.errors = ['Login failed'];
      }
    });
  }
  resetPassword() {
    //TODO
  }
}
