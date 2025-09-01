import { Component, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { TournamentService } from '../service/tournament.service';
import { MenuItem } from 'primeng/api';
import { MenuModule } from 'primeng/menu';
import { AvatarModule } from 'primeng/avatar';
import { ToolbarModule } from 'primeng/toolbar';
import { ButtonModule } from 'primeng/button';
import { UserService } from '../service/user.service';
import { TitleService } from '../service/title.service';

@Component({
  standalone: true,
  selector: 'app-main-menu',
  template: `
  <p-toolbar class="top-toolbar">
    <div class="p-toolbar-group-left">
      <p-menu #menu [model]="mainMenuItems()" [popup]="true"></p-menu>
      <span class="pi pi-bars" (click)="menu.toggle($event)"></span>
    </div>

    <div class="p-toolbar-group-center">
      <h2 class="page-title">{{titleService.title$()}}</h2>
    </div>

    <div class="p-toolbar-group-right">
      {{userName()}}
      <p-menu #userMenu [model]="userMenuItems()" [popup]="true" ></p-menu>
      <p-avatar icon="pi pi-user" styleClass="mr-2" shape="circle"
        (click)="onAvatarClick(userMenu, $event)">
      </p-avatar>
    </div>
  </p-toolbar>
  `,
  styles: [`
    .top-toolbar {
      position: fixed;
      top: 0;
      width: 100%;
      z-index: 1000;

      display: flex;
      justify-content: space-between;
      align-items: center;

      .p-toolbar-group-center {
        flex: 1;
        display: flex;
        justify-content: center;

        .page-title {
          margin: 0;
          font-size: 1.2rem;
          font-weight: 600;
        }
      }
    }
  `],
  imports: [AvatarModule, ButtonModule, MenuModule, ToolbarModule]
})
export class MainMenuComponent {
  router = inject(Router);
  titleService = inject(TitleService);
  title = signal('');

  userService = inject(UserService);
  userName = computed(() => {
    const current = this.userService.currentUser$()
    return current ? `${current.firstName} ${current.lastName}` : 'Guest';
  });

  tournamentService = inject(TournamentService);
  selectedTournament = computed(() => this.tournamentService.currentTournament());

  mainMenuItems = computed<MenuItem[] | undefined>(() => {
    const entries: MenuItem[] = [
      {
        label: 'Application',
        items: [
          { label: 'Home',                icon: 'pi pi-home',       routerLink: '/home' },
          { label: 'Tournaments',         icon: 'pi pi-list',       routerLink: '/tournament' }
        ]
      }
    ];
    if (this.selectedTournament()) {
      const tournament = this.selectedTournament()!;
      entries.push({
        label: `${tournament.name}`,
        items: [
          { label: 'Tournament home',     icon: 'pi pi-trophy',     routerLink: `/tournament/${tournament.id}/home` },
          { label: 'General config',      icon: 'pi pi-cog',        routerLink: `/tournament/${tournament.id}/edit` },
          { label: 'Games',               icon: 'pi pi-calendar',   routerLink: `/tournament/${tournament.id}/game` },
          { label: 'Referees',            icon: 'pi pi-users',      routerLink: `/tournament/${tournament.id}/referee` },
          { label: 'Referee Coaches',     icon: 'pi pi-user-plus',  routerLink: `/tournament/${tournament.id}/coach` },
          { label: 'Referee Allocations', icon: 'pi pi-map-marker', routerLink: `/tournament/${tournament.id}/allocation` },
        ]
      });
    }
    // TODO add admin entry
    return entries;
  });

  userMenuItems = computed(() => {
      const connectedUser = this.userService.currentUser$()!;
    if (this.userService.isConnected() && connectedUser) {
      return [
        {
          label: 'User',
          items: [
            { label: 'My Account', icon: 'pi pi-cog', routerLink: `/user/${connectedUser.id}` },
            { label: 'Log out',     icon: 'pi pi-sign-out', command: () => this.logout() }
          ]
        }
      ] as MenuItem[];
    } else {
      return [];
    }
  });
  onAvatarClick(userMenu: any, $event: any) {
    if (this.userService.isConnected()) {
      userMenu.toggle($event)
    } else {
      this.userService.autoLogin().subscribe({error: (err) => this.router.navigateByUrl('/user/login')});
    }
  }
  logout() {
    this.userService.logout();
    this.router.navigateByUrl('/home');
  }
}
