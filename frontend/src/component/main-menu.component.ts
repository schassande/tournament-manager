import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AvatarModule } from 'primeng/avatar';
import { DrawerModule } from 'primeng/drawer';
import { ToolbarModule } from 'primeng/toolbar';
import { take } from 'rxjs';
import { Attendee, AttendeeRole, ModulesNames, Tournament } from '@tournament-manager/persistent-data-model';
import { AttendeeService } from '../service/attendee.service';
import { TitleService } from '../service/title.service';
import { TournamentService } from '../service/tournament.service';
import { UserService } from '../service/user.service';

/** Describes one directly selectable drawer destination. */
interface DrawerMenuEntry {
  label: string;
  icon: string;
  route: string;
}

/** Describes an always-expanded visual group of drawer destinations. */
interface DrawerMenuGroup {
  label: string;
  entries: DrawerMenuEntry[];
}

@Component({
  selector: 'app-main-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarModule, DrawerModule, RouterLink, ToolbarModule],
  template: `
    <p-toolbar class="top-toolbar">
      <div class="p-toolbar-group-left">
        <button
          type="button"
          class="menu-toggle"
          aria-label="Open navigation menu"
          (click)="drawerVisible.set(true)"
        >
          <i class="pi pi-bars" aria-hidden="true"></i>
        </button>
      </div>

      <div class="p-toolbar-group-center">
        <h2 class="page-title">{{ titleService.title$() }}</h2>
      </div>
    </p-toolbar>

    <p-drawer
      [visible]="drawerVisible()"
      (visibleChange)="drawerVisible.set($event)"
      position="left"
      styleClass="main-menu-drawer"
      ariaLabel="Navigation menu"
      [style]="{ width: '14rem', 
        '--p-drawer-header-padding': '0', 
        '--p-drawer-content-padding': '0.5rem' }"
      [showCloseIcon]="false"
      [closable]="false"
    >
      <div class="drawer-content">
        <nav class="drawer-navigation" aria-label="Global navigation">
          @for (entry of globalMenuEntries; track entry.route) {
            <button type="button" class="drawer-entry" [routerLink]="entry.route" (click)="closeDrawer()">
              <i [class]="entry.icon" aria-hidden="true"></i>
              <span>{{ entry.label }}</span>
            </button>
          }
        </nav>

        @if (tournamentMenu()) {
          <div class="drawer-separator" role="separator"></div>

          <nav class="drawer-navigation" aria-label="Current tournament navigation">
            <button type="button" class="drawer-entry current-tournament-entry" [routerLink]="tournamentMenu()!.home.route" (click)="closeDrawer()">
              <i [class]="tournamentMenu()!.home.icon" aria-hidden="true"></i>
              <span>{{ tournamentMenu()!.home.label }}</span>
            </button>
            @if (tournamentMenu()!.generalConfig) {
              <button type="button" class="drawer-entry" [routerLink]="tournamentMenu()!.generalConfig!.route" (click)="closeDrawer()">
                <i [class]="tournamentMenu()!.generalConfig!.icon" aria-hidden="true"></i>
                <span>{{ tournamentMenu()!.generalConfig!.label }}</span>
              </button>
            }
            @for (group of tournamentMenu()!.groups; track group.label) {
              <div class="drawer-group-heading">{{ group.label }}</div>
              @for (entry of group.entries; track entry.route) {
                <button type="button" class="drawer-entry drawer-entry-nested" [routerLink]="entry.route" (click)="closeDrawer()">
                  <i [class]="entry.icon" aria-hidden="true"></i>
                  <span>{{ entry.label }}</span>
                </button>
              }
            }
          </nav>
        }

        <div class="drawer-separator" role="separator"></div>

        <div class="user-actions" aria-label="User actions">
          <div class="user-identity" aria-label="Current user">
            <p-avatar icon="pi pi-user" shape="circle"></p-avatar>
            <span class="user-name">
              <span>{{ userFirstName() }}</span>
              @if (userLastName()) {
                <span>{{ userLastName() }}</span>
              }
            </span>
          </div>
          @if (userService.isConnected()) {
            <button type="button" class="drawer-entry" [routerLink]="['/user', userService.currentUser$()?.id]" (click)="closeDrawer()">
              <i class="pi pi-cog" aria-hidden="true"></i>
              <span>My Account</span>
            </button>
            <button type="button" class="drawer-entry" (click)="logout()">
              <i class="pi pi-sign-out" aria-hidden="true"></i>
              <span>Log out</span>
            </button>
          } @else {
            <button type="button" class="drawer-entry" [routerLink]="['/user/login']" (click)="closeDrawer()">
              <i class="pi pi-sign-in" aria-hidden="true"></i>
              <span>Log in</span>
            </button>
            <button type="button" class="drawer-entry" [routerLink]="['/user/create']" (click)="closeDrawer()">
              <i class="pi pi-user-plus" aria-hidden="true"></i>
              <span>Register</span>
            </button>
          }
        </div>
      </div>
    </p-drawer>
  `,
  styles: [
    `
      .top-toolbar {
        box-sizing: border-box;
        height: 48px;
        min-height: 48px;
        padding-block: 0;
        position: fixed;
        top: 0;
        width: 100%;
        z-index: 1000;
        display: flex;
        justify-content: space-between;
        align-items: center;

        .p-toolbar-group-left {
          align-items: center;
          display: flex;
        }

        .p-toolbar-group-center {
          align-items: center;
          display: flex;
          left: 50%;
          justify-content: center;
          max-width: calc(100% - 6rem);
          position: absolute;
          transform: translateX(-50%);

          .page-title {
            overflow: hidden;
            margin: 0;
            font-size: 1.2rem;
            font-weight: 600;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }
      }

      .menu-toggle {
        border: 0;
        background: transparent;
        color: inherit;
        cursor: pointer;
        font-size: 1.5rem;
      }

      .user-identity,
      .drawer-entry {
        align-items: center;
        display: flex;
        gap: 0.75rem;
      }

      .user-identity {
        font-weight: 600;
      }

      .user-name {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

      .drawer-content {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .drawer-entry {
        background: transparent;
        border: 0;
        color: inherit;
        cursor: pointer;
        font: inherit;
        padding: 0.4rem 0.5rem;
        text-align: left;
        width: 100%;
      }

      .drawer-entry:hover,
      .drawer-entry:focus-visible {
        background: var(--p-content-hover-background, #f1f5f9);
        outline: none;
      }

      .drawer-entry-nested {
        padding-left: 1.5rem;
      }

      .current-tournament-entry {
        font-weight: 700;
      }

      .drawer-group-heading {
        color: var(--p-text-muted-color, #64748b);
        font-size: 0.85rem;
        font-weight: 600;
        margin-top: 0.5rem;
        padding: 0.2rem;
      }

      .drawer-separator {
        border-top: 1px solid var(--p-content-border-color, #e2e8f0);
        margin: 0.2rem 0;
      }
    `,
  ],
})
/** Displays the application toolbar and the context-aware navigation drawer. */
export class MainMenuComponent {
  readonly router = inject(Router);
  readonly titleService = inject(TitleService);
  readonly userService = inject(UserService);
  private readonly tournamentService = inject(TournamentService);
  private readonly attendeeService = inject(AttendeeService);
  readonly drawerVisible = signal(false);
  private readonly currentAttendee = signal<Attendee | null>(null);
  readonly selectedTournament = computed(() => this.tournamentService.currentTournament());
  readonly userFirstName = computed(() => this.userService.currentUser$()?.firstName ?? 'Guest');
  readonly userLastName = computed(() => this.userService.currentUser$()?.lastName ?? '');

  readonly globalMenuEntries: DrawerMenuEntry[] = [
    { label: 'Home', icon: 'pi pi-home', route: '/home' },
    { label: 'Tournaments', icon: 'pi pi-list', route: '/tournament' },
  ];

  readonly tournamentMenu = computed(() => {
    const tournament = this.selectedTournament();
    if (!tournament) return null;

    return {
      home: this.entry(`${tournament.name}`, 'pi pi-trophy', `/tournament/${tournament.id}/home`),
      generalConfig: this.hasRole('TournamentManager')
        ? this.entry('Configuration', 'pi pi-cog', `/tournament/${tournament.id}/edit`)
        : undefined,
      groups: this.buildTournamentGroups(tournament),
    };
  });

  constructor() {
    effect(() => {
      const tournament = this.selectedTournament();
      const user = this.userService.currentUser$();
      this.currentAttendee.set(null);
      if (tournament && user) {
        this.attendeeService.findByPerson(tournament.id, user.id).pipe(take(1)).subscribe(attendees => {
          this.currentAttendee.set(attendees[0] ?? null);
        });
      }
    });
  }

  /** Closes the navigation drawer after a route selection. */
  closeDrawer(): void {
    this.drawerVisible.set(false);
  }

  /** Logs out the current user and returns to the public home page. */
  logout(): void {
    this.userService.logout();
    this.closeDrawer();
    this.router.navigateByUrl('/home');
  }

  private buildTournamentGroups(tournament: Tournament): DrawerMenuGroup[] {
    const gameEntries: DrawerMenuEntry[] = [];
    const refereeEntries: DrawerMenuEntry[] = [];
    if (this.hasAnyRole('TournamentManager', 'GameAllocator', 'ResultManager')) {
      gameEntries.push(this.entry('Games', 'pi pi-calendar', `/tournament/${tournament.id}/game`));
    }
    if (this.hasRole('TournamentManager') && this.moduleEnabled(tournament, 'FIT_IMPORT')) {
      gameEntries.push(this.entry('Import FIT', 'pi pi-download', `/tournament/${tournament.id}/fit-import`));
    }
    if (this.hasAnyRole('TournamentManager', 'RefereeRanker')) {
      refereeEntries.push(this.entry('Referees', 'pi pi-users', `/tournament/${tournament.id}/referee`));
    }
    if (this.hasAnyRole('TournamentManager', 'RefereeCoachLeader')) {
      refereeEntries.push(this.entry('Coaches', 'pi pi-users', `/tournament/${tournament.id}/coach`));
    }
    if (this.hasRefereeCoachRight() || this.hasRole('TournamentManager')) {
      refereeEntries.push(this.entry('Allocations', 'pi pi-calendar', `/tournament/${tournament.id}/allocation`));
    }
    refereeEntries.push(this.entry('Planning', 'pi pi-calendar', `/tournament/${tournament.id}/referee-planning`));
    if (this.moduleEnabled(tournament, 'UPGRADE') && this.hasRefereeCoachRightOrManager()) {
      refereeEntries.push(this.entry('Upgrades', 'pi pi-arrow-up', `/tournament/${tournament.id}/referee-upgrade`));
    }
    return [
      { label: 'Game', entries: gameEntries },
      { label: 'Referee', entries: refereeEntries },
    ].filter(group => group.entries.length > 0);
  }

  private entry(label: string, icon: string, route: string): DrawerMenuEntry {
    return { label, icon, route };
  }

  private hasAnyRole(...roles: AttendeeRole[]): boolean {
    return roles.some(role => this.hasRole(role));
  }

  private hasRole(role: AttendeeRole): boolean {
    const attendee = this.currentAttendee();
    return attendee?.roles?.includes(role) === true
      || (role === 'TournamentManager' && attendee?.isTournamentManager === true);
  }

  private hasRefereeCoachRight(): boolean {
    return this.currentAttendee()?.isRefereeCoach === true;
  }

  private hasRefereeCoachRightOrManager(): boolean {
    return this.hasRefereeCoachRight() || this.hasRole('TournamentManager');
  }

  private moduleEnabled(tournament: Tournament, module: ModulesNames): boolean {
    return tournament.enablesModules?.includes(module) === true;
  }
}
