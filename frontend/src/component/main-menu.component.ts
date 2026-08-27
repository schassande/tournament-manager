import { Component, effect, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { TournamentService } from '../service/tournament.service';
import { MenuItem } from 'primeng/api';
import { TieredMenuModule } from 'primeng/tieredmenu';
import { AvatarModule } from 'primeng/avatar';
import { ToolbarModule } from 'primeng/toolbar';
import { ButtonModule } from 'primeng/button';
import { UserService } from '../service/user.service';
import { TitleService } from '../service/title.service';
import { AttendeeService } from '../service/attendee.service';
import { take } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-main-menu',
  template: `
    <p-toolbar class="top-toolbar">
      <div class="p-toolbar-group-left">
        <p-tieredmenu #menu [model]="mainMenuItems()" [popup]="true"></p-tieredmenu>
        <span class="pi pi-bars" (click)="menu.toggle($event)"></span>
      </div>

      <div class="p-toolbar-group-center">
        <h2 class="page-title">{{ titleService.title$() }}</h2>
      </div>

      <div class="p-toolbar-group-right">
        <span (click)="onAvatarClick(userMenu, $event)">{{ userName() }} </span>
        <p-tieredmenu #userMenu [model]="userMenuItems()" [popup]="true"></p-tieredmenu>
        <p-avatar
          icon="pi pi-user"
          styleClass="mr-2"
          shape="circle"
          (click)="onAvatarClick(userMenu, $event)"
        >
        </p-avatar>
      </div>
    </p-toolbar>
  `,
  styles: [
    `
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
    `,
  ],
  imports: [AvatarModule, ButtonModule, TieredMenuModule, ToolbarModule],
})
export class MainMenuComponent {
  router = inject(Router);
  titleService = inject(TitleService);
  title = signal('');

  userService = inject(UserService);
  userName = computed(() => {
    const current = this.userService.currentUser$();
    return current ? `${current.firstName} ${current.lastName}` : 'Guest';
  });

  tournamentService = inject(TournamentService);
  attendeeService = inject(AttendeeService);
  selectedTournament = computed(() =>
    this.tournamentService.currentTournament(),
  );
  canAccessRefereeUpgrade = signal(false);

  constructor() {
    effect(() => {
      const tournament = this.selectedTournament();
      const user = this.userService.currentUser$();
      this.canAccessRefereeUpgrade.set(false);
      if (tournament && user) {
        this.attendeeService.findByPerson(tournament.id, user.id).pipe(take(1)).subscribe((attendees) => {
          this.canAccessRefereeUpgrade.set(attendees.some((attendee) => attendee.isRefereeCoach));
        });
      }
    });
  }

  mainMenuItems = computed<MenuItem[]>(() => {
    let entries: MenuItem[] = [
      { label: 'Home', icon: 'pi pi-home', routerLink: '/home' },
      { label: 'Tournaments', icon: 'pi pi-list', routerLink: '/tournament' }
    ];
    if (this.selectedTournament()) {
      const tournament = this.selectedTournament()!;
      entries = entries.concat([
        { separator: true },
        {
          label: `${tournament.name}`,
          icon: 'pi pi-trophy',
          routerLink: `/tournament/${tournament.id}/home`
        },
        {
          label: 'General config',
          icon: 'pi pi-cog',
          routerLink: `/tournament/${tournament.id}/edit`
        },
        {
          label: 'Game',
          icon: 'pi pi-calendar',
          items: [
            {
              label: 'Games',
              icon: 'pi pi-calendar',
              routerLink: `/tournament/${tournament.id}/game`
            },
            {
              label: 'Import FIT',
              icon: 'pi pi-download',
              routerLink: `/tournament/${tournament.id}/fit-import`
            }
          ]
        },
        {
          label: 'Referee',
          icon: 'pi pi-users',
          items: [
            {
              label: 'Referees',
              routerLink: `/tournament/${tournament.id}/referee`,
            },
            {
              label: 'Coaches',
              routerLink: `/tournament/${tournament.id}/coach`,
            },
            {
              label: 'Allocations',
              routerLink: `/tournament/${tournament.id}/allocation`,
            },
            {
              label: 'Planning',
              routerLink: `/tournament/${tournament.id}/referee-planning`,
            },
            ...(this.canAccessRefereeUpgrade() ? [{
                label: 'Upgrades',
                routerLink: `/tournament/${tournament.id}/referee-upgrade`,
              }] : []),
          ],
        },
      ]);
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
            {
              label: 'My Account',
              icon: 'pi pi-cog',
              routerLink: `/user/${connectedUser.id}`,
            },
            {
              label: 'Log out',
              icon: 'pi pi-sign-out',
              command: () => this.logout(),
            },
          ],
        },
      ] as MenuItem[];
    } else {
      return [];
    }
  });
  onAvatarClick(userMenu: any, $event: any) {
    if (this.userService.isConnected()) {
      userMenu.toggle($event);
    } else {
      this.router.navigateByUrl('/user/login');
      //this.userService.autoLogin().subscribe({error: (err) => this.router.navigateByUrl('/user/login')});
    }
  }
  logout() {
    this.userService.logout();
    this.router.navigateByUrl('/home');
  }
}
