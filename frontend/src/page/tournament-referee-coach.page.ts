import { Component, effect, inject, signal } from '@angular/core';
import { firstValueFrom, forkJoin, map, mergeMap, Observable, of, take } from 'rxjs';
import { ConfirmationService } from 'primeng/api';
import { AbstractTournamentPage } from '../component/tournament-abstract.page';
import { AttendeeService } from '../service/attendee.service';
import { PersonService } from '../service/person.service';
import { RegionService } from '../service/region.service';
import { Attendee, Person, RefereeBadgeSystem, RefereeCoach, RefereeCoachBadgeSystem } from '@tournament-manager/persistent-data-model';
import { TournamentRefereeCoachEditComponent } from '../component/tournament-referee-coach-edit.component';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogService } from 'primeng/dynamicdialog';

@Component({
  selector: 'app-tournament-referee-coach',
  imports: [ButtonModule, CommonModule, ConfirmDialogModule, FormsModule, TableModule],
  template: `
  @if (tournament() && refereeCoaches()) {
    <div class="buttonPanel">
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
                  (paste)="onPaste($event, ri, 'FN')" (ngModelChange)="attendeeChanged(coach)"/>
                  </ng-template>
                <ng-template #output>{{ coach.attendee.person.firstName }}</ng-template>
              </p-cellEditor>
            </td>

            <td [pEditableColumn]="coach.attendee.person?.lastName" pEditableColumnField="lastName" style="text-align: center;">
              <p-cellEditor>
                <ng-template #input>
                  <input pInputText type="text" [(ngModel)]="coach.attendee.person.lastName"
                    minlength="1" maxlength="30" style="width: 15rem;"
                    (paste)="onPaste($event, ri, 'LN')"  (ngModelChange)="attendeeChanged(coach)"/>
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
                    (ngModelChange)="attendeeChanged(coach)"/>
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
    .buttonPanel { text-align: right; margin: 10px 0;}
    .table-buttons { margin: 0 10px;}
  `],
  standalone: true
})
export class TournamentRefereeCoachComponent  extends AbstractTournamentPage {

  attendeeService = inject(AttendeeService);
  personService = inject(PersonService);
  regionService = inject(RegionService);
  confirmationService = inject(ConfirmationService);
  dialogService = inject(DialogService);

  refereeCoaches = signal<RefereeCoach[]>([]);

  constructor() {
    super();
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
        const refereeCoaches: RefereeCoach[] = attendees.map((attendee: Attendee) => { return { attendee }; });
        this.sortReferees(refereeCoaches);
        this.refereeCoaches.set([...refereeCoaches]);
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
        fontColor: 'x000000',
        backgroundColor: 'xffffff'
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
      roles: [],
      lastChange: 0
    };
    return firstValueFrom(this.attendeeService.save(attendee).pipe(
      map(att => { return { attendee: att}; })
    ));
  }
  protected async removeRefereeCoach(...refereeCoachesToremove: RefereeCoach[]) {
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
  attendeeChanged(coach: RefereeCoach) {
    // console.debug('Saving coach', coach);
    this.autoComputeShortName(coach.attendee);
    this.attendeeService.save(coach.attendee).subscribe();
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
