import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { firstValueFrom, forkJoin, map, mergeMap, Observable, of, take } from 'rxjs';
import { ConfirmationService } from 'primeng/api';
import { AbstractTournamentPage } from '../../component/tournament-abstract.page';
import { AttendeeService } from '../../service/attendee.service';
import { PersonService } from '../../service/person.service';
import { RegionService } from '../../service/region.service';
import { Attendee, attendeeCoachRoles, normalizeIdentityEmail, Person, RefereeBadgeSystem, RefereeCoach, RefereeCoachBadgeSystem } from '@tournament-manager/persistent-data-model';
import { TournamentRefereeCoachEditComponent } from '../../component/tournament-referee-coach-edit.component';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogService } from 'primeng/dynamicdialog';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { UserService } from '../../service/user.service';

@Component({
  selector: 'app-tournament-referee-coach',
  imports: [ButtonModule, CommonModule, ConfirmDialogModule, FormsModule, TableModule, ToggleSwitchModule],
  template: `
  @if (tournament() && refereeCoaches()) {
    <div class="buttonPanel">
      <span class="email-toggle">
        <p-toggleswitch [(ngModel)]="showEmails"></p-toggleswitch>
        <label for="show-coach-emails">Show emails</label>
        @if (showEmails) {
          <span class="email-statistic" aria-label="referee coaches with linked accounts">
            <i class="pi pi-user linked-account-icon" aria-hidden="true"></i> {{ linkedEmailPercentage() }}%
          </span>
        }
      </span>
      <p-button (click)="addRefereeCoach()" icon="pi pi-add" label="Add a referee coach"></p-button>
    </div>
    <p-table [value]="refereeCoaches()" stripedRows showGridlines [size]="'small'" tableLayout="fixed">
      <ng-template #header>
          <tr class="tableRowTitle">
            <th style="width:30%">First name</th>
            <th style="width:30%">Last Name</th>
            <th style="width:10%">Short Name</th>
            <th style="width:10%">Level</th>
            <th style="width:10%">Upgrade to</th>
            @if (showEmails) {
              <th style="width:20%; text-align: left">Email</th>
            }
            <th style="width:10%">Action</th>
          </tr>
      </ng-template>
      <ng-template #body let-coach let-ri="rowIndex">
          <tr class="tableRowItem">

            <td [pEditableColumn]="coach.attendee.person?.firstName" pEditableColumnField="firstName" style="text-align: center;">
              <p-cellEditor>
                <ng-template #input>
                  <input pInputText type="text" [(ngModel)]="coach.attendee.person.firstName"
                  minlength="1" maxlength="30" style="width: 15rem;"
                  (paste)="onPaste($event, ri, 'FN')" (ngModelChange)="scheduleAttendeeSave(coach)"
                  (blur)="flushAttendeeSave(coach)"/>
                  </ng-template>
                <ng-template #output>{{ coach.attendee.person.firstName }}</ng-template>
              </p-cellEditor>
            </td>

            <td [pEditableColumn]="coach.attendee.person?.lastName" pEditableColumnField="lastName" style="text-align: center;">
              <p-cellEditor>
                <ng-template #input>
                  <input pInputText type="text" [(ngModel)]="coach.attendee.person.lastName"
                    minlength="1" maxlength="30" style="width: 15rem;"
                    (paste)="onPaste($event, ri, 'LN')" (ngModelChange)="scheduleAttendeeSave(coach)"
                    (blur)="flushAttendeeSave(coach)"/>
                  </ng-template>
                <ng-template #output>{{ coach.attendee.person.lastName }}</ng-template>
              </p-cellEditor>
            </td>

            <td [pEditableColumn]="coach.attendee.person?.shortName" pEditableColumnField="shortName"
              style="text-align: center; 
                  color: {{coach!.attendee!.refereeCoach?.fontColor}}; 
                  background-color: {{coach!.attendee!.refereeCoach?.backgroundColor}}">
              <p-cellEditor>
                <ng-template #input>
                  <input pInputText type="text" [(ngModel)]="coach.attendee.person.shortName"
                    minlength="3" maxlength="6" style="width: 5rem;"
                    (ngModelChange)="scheduleAttendeeSave(coach)" (blur)="flushAttendeeSave(coach)"/>
                  </ng-template>
                <ng-template #output>{{ coach.attendee.person.shortName }}</ng-template>
              </p-cellEditor>
            </td>
            <td [pEditableColumn]="coach.attendee.refereeCoach.badge" pEditableColumnField="refereeCoachLevel" style="text-align: center;">
              <p-cellEditor>
                <ng-template #input>
                  <input pInputText type="number" [(ngModel)]="coach.attendee.refereeCoach.badge"
                    (paste)="onPaste($event, ri, 'CB')" (ngModelChange)="attendeeChanged(coach)"
                    min="0" max="{{coach!.attendee!.refereeCoach!.badgeSystem}}"/>
                </ng-template>
                <ng-template #output>L{{ coach.attendee.refereeCoach.badge }}/{{ coach.attendee.refereeCoach.badgeSystem }}</ng-template>
              </p-cellEditor>
            </td>
            <td [pEditableColumn]="coach.attendee.refereeCoach.upgrade?.badge" pEditableColumnField="refereeCoachUpgrade" style="text-align: center;">
              <p-cellEditor>
                <ng-template #input>
                  <input pInputText type="number" [(ngModel)]="coach!.attendee!.refereeCoach!.upgrade!.badge" style="width: 2rem;"
                    (paste)="onPaste($event, ri, 'UB')"  (ngModelChange)="upgradeChanged(coach, $event)"
                    min="0" max="{{coach!.attendee!.refereeCoach!.upgrade?.badgeSystem || coach!.attendee!.refereeCoach!.badgeSystem}}"/>
                </ng-template>
                <ng-template #output>
                  @if (coach.attendee.refereeCoach.upgrade?.badge === 0){
                    <span>-</span>
                  } @else {
                    <span>L{{ coach.attendee.refereeCoach.upgrade?.badge }}</span>
                  }
                </ng-template>
              </p-cellEditor>
            </td>
            @if (showEmails) {
              <td [pEditableColumn]="emailValue(coach)" pEditableColumnField="email"
                [pEditableColumnDisabled]="isCurrentUserEmail(emailValue(coach))" style="text-align: left;">
                <p-cellEditor>
                  <ng-template #input>
                    <input pInputText type="email" [ngModel]="emailValue(coach)"
                      (ngModelChange)="emailDraftChanged(coach, $event)"
                      maxlength="254" style="width: 15rem;" aria-label="Referee coach email" />
                  </ng-template>
                  <ng-template #output>
                    @if (coach.attendee.person?.personId && emailValue(coach)) {
                      <i class="pi pi-user linked-account-icon" aria-label="Email linked to an application account"></i>
                    }
                    {{ emailValue(coach) }}
                    @if (isCurrentUserEmail(emailValue(coach))) {
                      <i class="pi pi-lock current-user-lock" aria-label="Your email cannot be edited"></i>
                    }
                  </ng-template>
                </p-cellEditor>
              </td>
            }
            <td style="text-align: center;">
              <i class="pi pi-trash action action-remove" aria-label="remove referee" (click)="removeRefereeCoach(coach)"></i>
              <i class="pi pi-pencil action action-edit" aria-label="edit referee" (click)="editRefereeCoach(coach)"></i>
            </td>
          </tr>
      </ng-template>
    </p-table>
  }
    <p-confirmDialog [style]="{width: '40vw'}"></p-confirmDialog>
  `,
  styles: [`
    .tableRowTitle th { text-align: center;}
    .action { font-size: 1.3rem}
    .action-remove { margin-right: 10px; color: red;}
    .action-edit { margin-right: 10px; color: blue;}
    .buttonPanel { display: flex; align-items: center; margin: 10px 0;}
    .buttonPanel > p-button { margin-left: auto; }
    .table-buttons { margin: 0 10px;}
    .email-toggle { display: inline-flex; align-items: center; margin-left: 10px; gap: 10px; }
    .email-statistic { margin-left: 10px; }
    .linked-account-icon { color: var(--p-green-500, #22c55e); background: transparent; }
    .current-user-lock { color: #4b5563; background: transparent; margin-left: 4px; }
  `],
  standalone: true
})
export class TournamentRefereeCoachComponent  extends AbstractTournamentPage {

  attendeeService = inject(AttendeeService);
  personService = inject(PersonService);
  regionService = inject(RegionService);
  confirmationService = inject(ConfirmationService);
  dialogService = inject(DialogService);
  readonly userService = inject(UserService);

  refereeCoaches = signal<RefereeCoach[]>([]);
  private readonly pendingSaves = new Map<string, { coach: RefereeCoach; timer: ReturnType<typeof setTimeout> }>();
  showEmails = false;
  private readonly emailDrafts = new WeakMap<RefereeCoach, string>();
  private readonly emailSaveTimers = new WeakMap<RefereeCoach, ReturnType<typeof setTimeout>>();

  constructor() {
    super();
    inject(DestroyRef).onDestroy(() => {
      for (const { coach } of this.pendingSaves.values()) {
        this.flushAttendeeSave(coach);
      }
    });
    effect(() => {
      this.tournament();
      if (this.tournament()) {
        this.loadRefereeCoaches();
      }
    });
  }
  loadRefereeCoaches() {
    //find attendees having isReferee = true
    this.attendeeService.findTournamentRefereeCoaches(this.tournament()!.id).pipe(
      map((attendees) => { // convert attendees to referees
        const refereeCoaches: RefereeCoach[] = attendees.map((attendee: Attendee) => { 
          let changed = false;
          if (!attendee.refereeCoach) {
            attendee.refereeCoach = { badge: 0, badgeSystem: 5, fontColor: 'black', backgroundColor: 'white'};
            changed = true;
          }
          if (!attendee.refereeCoach.upgrade) {
            attendee.refereeCoach.upgrade = { badge: 0, badgeSystem: 5};
            changed = true;
          }
          if (changed) {
            this.attendeeService.save(attendee).subscribe();
          }
          return { attendee }; 
        });
        this.sortReferees(refereeCoaches);
        this.refereeCoaches.set([...refereeCoaches]);
        this.showEmails = refereeCoaches.some((coach) =>
          Boolean(coach.attendee.person?.email?.trim() && coach.attendee.person?.personId));
      }),
    ).subscribe()
  }

  private sortReferees(refereeCoaches: RefereeCoach[]) {
    refereeCoaches.sort((r1,r2) => r1.attendee.person!.lastName.localeCompare(r2.attendee.person!.lastName));
  }

  async addRefereeCoach() {
    const rc = await this.createRefereeCoach()
    this.refereeCoaches.update((refereeCoaches) => {
      return [...refereeCoaches, rc ];
    });
  }
  private async createRefereeCoach(): Promise<RefereeCoach> {
    const defaultBadgeSystem: RefereeCoachBadgeSystem = this.tournament()!.defaultRefereeCoachBadgeSystem ?? 5;
    const attendee: Attendee = {
      id: '',
      tournamentId: this.tournament()!.id,
      isReferee: false,
      isPlayer: false,
      isRefereeCoach: true,
      isTournamentManager: false,
      refereeCoach: {
        badge: 0,
        badgeSystem:defaultBadgeSystem,
        upgrade : { 
          badge: 0, 
          badgeSystem: defaultBadgeSystem 
        },
        fontColor: '#000000',
        backgroundColor: '#ffffff'
      },
      person: {
        firstName: '',
        lastName: '',
        gender: 'M',
        email: '',
        shortName: '',
        regionId: this.tournament()!.regionId,
        countryId: this.tournament()!.countryId,
      },
      roles: ['Coach'],
      lastChange: 0
    };
    return firstValueFrom(this.attendeeService.save(attendee).pipe(
      map(att => { return { attendee: att}; })
    ));
  }
  /** Cancels pending identity edits and removes each coach or their coach role. */
  protected async removeRefereeCoach(...refereeCoachesToremove: RefereeCoach[]) {
    refereeCoachesToremove.forEach(coach => this.cancelAttendeeSave(coach));
      // remove the referee from the list
      const refereeCoaches = this.refereeCoaches().filter((r1) =>  
        refereeCoachesToremove.filter(r2 => r1.attendee.id !== r2.attendee.id).length > 0 );
      this.refereeCoaches.set(refereeCoaches);

    // Delete the attendee or the RefereCoach role of each referee
    await Promise.all(refereeCoachesToremove.map(async coach => {
      if (coach.attendee.id && this.attendeeService.isOnlyRefereeCoach(coach.attendee)) {
        // remove the attendee from the database
          await this.attendeeService.delete(coach.attendee.id);
        // Note: Use less person will be removed by daily job
      } else {
        // remove the role and save the change in the database
        coach.attendee.isRefereeCoach = false;
        coach.attendee.roles = coach.attendee.roles.filter(r => r !== 'Coach');
        await this.attendeeService.save(coach.attendee);
      }
        //TODO remove the referee coach from the allocation, upgrades, ranking ...
    }));
  }
  async editRefereeCoach(coach: RefereeCoach) {
    const ref = this.dialogService.open(TournamentRefereeCoachEditComponent, {
      header: 'Find or edit a referee coach',
      width: '70%',
      closeOnEscape: true,
      focusOnShow: true,
      dismissableMask: true,
      closable: true,
      resizable: true,
      contentStyle: { overflow: 'auto' },
      baseZIndex: 10000,
      maximizable: true,
      modal: true,
      inputValues: {
        coach,
        tournament: this.tournament()
      }
    });
    ref.onClose.subscribe(() => {
      this.refereeCoaches.update(refereeCoaches => {
        const idx = refereeCoaches.findIndex(r => r.attendee.id === coach.attendee.id);
        if (idx >= 0) {
          refereeCoaches.splice(idx, 1, coach);
          this.attendeeChanged(coach);
          this.sortReferees(refereeCoaches);
          return [...refereeCoaches];
        } else {
          return refereeCoaches;
        }
      });
    });
  }
  /** Saves the current coach with an authoritative coach role, consuming pending identity edits. */
  attendeeChanged(coach: RefereeCoach) {
    this.cancelAttendeeSave(coach);
    this.autoComputeShortName(coach.attendee);
    // Legacy coaches may have only the boolean flag; the server derives it from roles.
    if (!coach.attendee.roles.some(role => attendeeCoachRoles.includes(role))) {
      coach.attendee.roles = [...coach.attendee.roles, 'Coach'];
    }
    // Save a snapshot so a late response cannot replace newer typing.
    this.attendeeService.save(structuredClone(coach.attendee)).subscribe();
  }

  /** Returns the transient email value displayed by the coach table. */
  emailValue(coach: RefereeCoach): string {
    return this.emailDrafts.get(coach) ?? coach.attendee.person?.email ?? '';
  }

  /** Debounces coach email persistence while the user is typing. */
  emailDraftChanged(coach: RefereeCoach, email: string): void {
    this.emailDrafts.set(coach, email);
    const previousTimer = this.emailSaveTimers.get(coach);
    if (previousTimer) clearTimeout(previousTimer);
    this.emailSaveTimers.set(coach, setTimeout(() => this.saveEmail(coach, email), 1000));
  }

  /** Normalizes and persists the final coach email value. */
  private saveEmail(coach: RefereeCoach, email: string): void {
    email = email.trim().toLowerCase();
    this.emailDrafts.set(coach, email);
    if (coach.attendee.person) coach.attendee.person.email = email;
    this.attendeeChanged(coach);
  }

  /** Computes the live percentage of referee coaches linked to application accounts. */
  linkedEmailPercentage(): number {
    const coaches = this.refereeCoaches();
    if (coaches.length === 0) return 0;
    const linked = coaches.filter((coach) =>
      Boolean(this.emailValue(coach).trim() && coach.attendee.person?.personId)).length;
    return Math.round((linked / coaches.length) * 100);
  }
  /** Returns whether an email belongs to the currently authenticated user. */
  isCurrentUserEmail(email: string): boolean {
    const currentEmail = this.userService.currentUser$()?.email;
    return Boolean(email.trim() && currentEmail
      && normalizeIdentityEmail(email) === normalizeIdentityEmail(currentEmail));
  }

  /** Saves identity edits after 500 ms without typing, independently for each coach. */
  scheduleAttendeeSave(coach: RefereeCoach): void {
    this.cancelAttendeeSave(coach);
    const timer = setTimeout(() => this.flushAttendeeSave(coach), 500);
    this.pendingSaves.set(coach.attendee.id, { coach, timer });
  }

  /** Flushes an edited field on blur or page destruction without duplicating completed saves. */
  flushAttendeeSave(coach: RefereeCoach): void {
    const pending = this.pendingSaves.get(coach.attendee.id);
    if (pending) {
      this.attendeeChanged(pending.coach);
    }
  }

  /** Cancels a delayed save before replacing it, saving immediately, or removing the coach. */
  private cancelAttendeeSave(coach: RefereeCoach): void {
    const pending = this.pendingSaves.get(coach.attendee.id);
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingSaves.delete(coach.attendee.id);
    }
  }
  autoComputeShortName(attendee: Attendee): boolean {
    const p = attendee.person;
    if (p && !p.shortName && p.firstName.length > 0 && p.lastName.length > 1) {
      p.shortName =
        p.firstName.substring(0, 1).toUpperCase()
        + p.lastName.substring(0, 1).toUpperCase()
        + p.lastName.substring(p.lastName.length-1, p.lastName.length).toUpperCase();
      return true;
    }
    return false;
  }

  upgradeChanged(coach: RefereeCoach, value:number) {
    if (coach.attendee.refereeCoach) coach.attendee.refereeCoach!.upgrade!.badge = value;
    this.attendeeChanged(coach);
  }

  onPaste(event: any, ri:number, col: 'FN'|'LN'|'CB'|'UB') {
    //TODO implement Paste of the first name/last name of the referee coach. See implementation in TournamentReferee page.
  }
}
