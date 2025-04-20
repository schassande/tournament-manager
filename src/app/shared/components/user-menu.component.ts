import { UserService } from './../services/user.service';
import { Component, inject, output } from '@angular/core';

@Component({
  standalone: false,
  selector: 'app-user-menu',
  template: `<ion-list>
    <ion-item (click)="logout()">Log out</ion-item>
  </ion-list>`,
  styles: [''],
})
export class UserMenuComponent{
  userService = inject(UserService);
  closeMenu = output();

  logout() {
    this.closeMenu.emit();
    this.userService.logout();
  }
}
