import { Component, computed, inject } from '@angular/core';
import { UserService } from '../services/user.service';
import { toSignal } from '@angular/core/rxjs-interop'
import { map } from 'rxjs';
import { Person } from '../data.model';

@Component({
  standalone: false,
  selector: 'app-user-menu-title',
  template: `
    <ion-chip>
      <ion-label>{{userName()}}</ion-label>
      <ion-avatar>
        <img alt="Silhouette of a person's head" src="https://ionicframework.com/docs/img/demos/avatar.svg" />
      </ion-avatar>
    </ion-chip>
  `
})
export class UserMenuTitleComponent {
  userService = inject(UserService);
  userName = computed(() => {
    const current = this.userService.currentUser$()
    if (current) {
      return `${current.firstName} ${current.lastName}`;
    }
    return 'Guest';
  });
}
