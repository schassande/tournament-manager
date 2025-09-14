import { Component, effect, inject, signal } from '@angular/core';
import { forkJoin, map, mergeMap, Observable, of, take } from 'rxjs';
import { ConfirmationService } from 'primeng/api';
import { AbstractTournamentPage } from '../component/tournament-abstract.page';
import { AttendeeService } from '../service/attendee.service';
import { PersonService } from '../service/person.service';
import { RegionService } from '../service/region.service';
import { Attendee, Person, RefereeBadgeSystem, RefereeCoach } from '@tournament-manager/persistent-data-model';
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

            <td [pEditableColumn]="coach.person?.firstName" pEditableColumnField="firstName" style="text-align: center;">
              <p-cellEditor>
                <ng-template #input>
                  <input pInputText type="text" [(ngModel)]="coach.person.firstName"
                  minlength="1" maxlength="30" style="width: 15rem;"
                  (paste)="onPasteFirstName($event, ri)" (change)="personChanged(coach)"/>
                  </ng-template>
                <ng-template #output>{{ coach.person.firstName }}</ng-template>
              </p-cellEditor>
            </td>

            <td [pEditableColumn]="coach.person?.lastName" pEditableColumnField="lastName" style="text-align: center;">
              <p-cellEditor>
                <ng-template #input>
                  <input pInputText type="text" [(ngModel)]="coach.person.lastName"
                    minlength="1" maxlength="30" style="width: 15rem;"
                    (paste)="onPasteLastName($event, ri)"  (change)="personChanged(coach)"/>
                  </ng-template>
                <ng-template #output>{{ coach.person.lastName }}</ng-template>
              </p-cellEditor>
            </td>

            <td [pEditableColumn]="coach.person?.shortName" pEditableColumnField="shortName"
              style="text-align: center; color: {{coach!.attendee!.refereeCoach!.fontColor}}; background-color: {{coach!.attendee!.refereeCoach!.backgroundColor}}">
              <p-cellEditor>
                <ng-template #input>
                  <input pInputText type="text" [(ngModel)]="coach.person.shortName"
                    minlength="3" maxlength="6" style="width: 5rem;"
                    (paste)="onPasteLastName($event, ri)"  (change)="personChanged(coach)"/>
                  </ng-template>
                <ng-template #output>{{ coach.person.shortName }}</ng-template>
              </p-cellEditor>
            </td>
            <td [pEditableColumn]="coach.attendee.refereeCoach.badge" pEditableColumnField="refereeCoachLevel" style="text-align: center;">
              <p-cellEditor>
                // Referee level selector
                <ng-template #input>
                  <input pInputText type="number" [(ngModel)]="coach.attendee.refereeCoach.badge"
                    (paste)="onPasteLevel($event, ri)" (change)="attendeeChanged(coach)"
                    min="0" max="{{coach!.attendee!.refereeCoach!.badgeSystem}}"/>
                </ng-template>
                <ng-template #output>L{{ coach.attendee.refereeCoach.badge }}/{{ coach.attendee.refereeCoach.badgeSystem }}</ng-template>
              </p-cellEditor>
            </td>
            <td [pEditableColumn]="coach.attendee.refereeCoach.upgrade?.badge" pEditableColumnField="refereeCoachUpgrade" style="text-align: center;">
              <p-cellEditor>
                <ng-template #input>
                  <input pInputText type="number" [(ngModel)]="coach!.attendee!.refereeCoach!.upgrade!.badge" style="width: 2rem;"
                    (paste)="onPasteLevel($event, ri)"  (ngModelChange)="upgradeChanged(coach, $event)"
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
    <div class="buttonPanel">
      <p-button (click)="addRefereeCoach()" icon="pi pi-add" label="Add a referee coach"></p-button>
    </div>
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
        const refereeCoaches: RefereeCoach[] = attendees.map((attendee: Attendee) => {
          return { attendee };
        });
        return refereeCoaches;
      }),

      // complete the referee attributes
      mergeMap((refereeCoaches: RefereeCoach[]) => {
        let obs: Observable<any>[] = [of('')];
        refereeCoaches.forEach(coach => {
          if (coach.attendee.personId) {
            // console.log('Loading person: personId=', coach.attendee.personId);
            //load person
            obs.push(this.personService.byId(coach.attendee.personId).pipe(
              map((person: Person|undefined) => {
                if (person) coach.person = person;
                // console.debug('Loaded person: personId=', coach.attendee.personId, person);
                return coach;
              }),
              take(1) // due to the use of the forkJoin operator
            ));
          }
        });
        // return referees after all observables are completed;
        return forkJoin(obs).pipe(map(()=> refereeCoaches));
      }),
      map(refereeCoaches => {
        //console.log('data loaded='+JSON.stringify(a));
        this.sortReferees(refereeCoaches);
        this.refereeCoaches.set([]);
        setTimeout(() => this.refereeCoaches.set(refereeCoaches), 100)
      }),
    ).subscribe()
  }

  private sortReferees(refereeCoaches: RefereeCoach[]) {
    refereeCoaches.sort((r1,r2) => r1.person!.lastName.localeCompare(r2.person!.lastName));
  }

  addRefereeCoach() {
    this.refereeCoaches.update((refereeCoaches) => {
      return [...refereeCoaches, this._addRefereeCoach() ];
    });
  }
  private _addRefereeCoach(): RefereeCoach {
    const tournamentCuntry = this.regionService.countryById(this.tournament()!.countryId);
    const defaultBadgeSystem: RefereeBadgeSystem = tournamentCuntry?.badgeSystem ? tournamentCuntry.badgeSystem : 5;
    const attendee: Attendee = {
      id: '',
      personId: '',
      tournamentId: this.tournament()!.id,
      isReferee: false,
      isPlayer: false,
      isRefereeCoach: true,
      isTournamentManager: false,
      refereeCoach: {
        badge: 0,
        badgeSystem: defaultBadgeSystem,
        upgrade : { badge: 0, badgeSystem: defaultBadgeSystem },
        fontColor: 'x000000',
        backgroundColor: 'xffffff'
      },
      roles: [],
      partDays: [],
      lastChange: 0
    };
    const person: Person = {
      id: '',
      firstName: '',
      lastName: '',
      gender: 'M',
      email: '',
      userAuthId: '',
      shortName: '',
      regionId: this.tournament()!.regionId,
      countryId: this.tournament()!.countryId,
      lastChange: 0,
      refereeCoach: {
        badge: 0,
        badgeSystem: defaultBadgeSystem,
        upgrade : { badge: 0, badgeSystem: defaultBadgeSystem },
        fontColor: 'x000000',
        backgroundColor: 'xffffff'
      },
    };
    this.personService.save(person).pipe(
      map((p) => {
        person.id = p.id;
        attendee.personId = p.id;
        return person;
      }),
      mergeMap(() => this.attendeeService.save(attendee)),
      map(a => attendee.id = a.id)
    ).subscribe();
    return { attendee, person};
  }
  removeRefereeCoach(...refereeCoachesToremove: RefereeCoach[]) {
      // remove the referee from the list
      const referees = this.refereeCoaches().filter((r1) =>  refereeCoachesToremove.filter(r2 => r1.attendee.id !== r2.attendee.id).length > 0 );
      refereeCoachesToremove.forEach(coach => {
        if (coach.attendee.id && this.attendeeService.isOnlyRefereeCoach(coach.attendee)) {
          // remove the attendee from the database
          this.attendeeService.delete(coach.attendee.id);
          // Note: Use less person will be removed by daily job

          //TODO remove the referee coach from the games

        } // else the attendee is not saved yet, so we just remove it from the list
      });
      this.refereeCoaches.set([]);
      setTimeout(() => this.refereeCoaches.set(referees), 100);
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
        this.attendeeChanged(coach);
        this.personChanged(coach);
        const idx = refereeCoaches.findIndex(r => r.attendee.id === coach.attendee.id);
        if (idx >= 0) refereeCoaches.splice(idx, 1, coach);
        setTimeout(() => this.refereeCoaches.set(refereeCoaches), 100);
        return [];
      });
    });
  }
  attendeeChanged(coach: RefereeCoach) {
    console.debug('Saving coach', coach)
    this.attendeeService.save(coach.attendee).subscribe();
  }
  autoComputeShortName(p: Person): boolean {
    if (!p.shortName && p.firstName.length > 0 && p.lastName.length > 1) {
      p.shortName =
        p.firstName.substring(0, 1).toUpperCase()
        + p.lastName.substring(0, 1).toUpperCase()
        + p.lastName.substring(p.lastName.length-1, p.lastName.length).toUpperCase();
      return true;
    }
    return false;
  }

  personChanged(coach: RefereeCoach) {
    const p:Person = coach.person!;
    this.autoComputeShortName(p);
    this.personService.save(p).subscribe();
  }


  upgradeChanged(coach: RefereeCoach, value:number) {
    if (coach.attendee.refereeCoach) coach.attendee.refereeCoach!.upgrade!.badge = value;
    if (coach && coach.person)  coach.person.refereeCoach = coach.attendee.refereeCoach;
    this.attendeeChanged(coach);
  }

  onPasteLevel(event: any, ri:number) {}
  onPasteFirstName(event: any, ri: number) {}
  onPasteLastName(event:any, ri: number) {}
}
