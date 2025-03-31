import { UserService } from './../../services/user.service';
import { Component, inject, input, OnInit, output } from '@angular/core';

@Component({
  standalone: false,
  selector: 'app-user-menu',
  templateUrl: './user-menu.component.html',
  styleUrls: ['./user-menu.component.scss'],
})
export class UserMenuComponent{
  userService = inject(UserService);
  closeMenu = output();

  logout() {
    this.closeMenu.emit();
    this.userService.logout();
  }
}
