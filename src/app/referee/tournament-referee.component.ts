import { TournamentRefereeEditComponent } from './tournament-referee-edit.component';
import { RegionService } from 'src/app/shared/services/region.service';
import { Gender, Referee, RefereeBadgeSystem, RefereeCategory, Team, TeamDivision} from './../shared/data.model';
import { Component, effect, inject, signal } from '@angular/core';
import { forkJoin, map, merge, mergeMap, Observable, of, take } from 'rxjs';
import { Attendee, Person } from 'src/app/shared/data.model';
import { AttendeeService } from 'src/app/shared/services/attendee.service';
import { PersonService } from 'src/app/shared/services/person.service';
import { AbstractTournamentComponent } from 'src/app/shared/tournament-abstract.service';
import { ModalController } from '@ionic/angular';
import { ConfirmationService } from 'primeng/api';

@Component({
  selector: 'app-tournament-referee',
  template: `
    <div *ngIf="tournament()">

    <h2>General refereee configuration</h2>
    <div class="chapterSection">
      <div class="form-field">
        <p-toggleswitch [(ngModel)]="tournament()!.allowPlayerReferees" (onChange)="onAllowPlaeyrRefereesChanged()"/>
        <label for="name">Do you use Player Referees?</label>
      </div>
    </div>

    <h2>List of referees</h2>
    <div class="chapterSection" *ngIf="referees()">
      <div *ngIf="tournament()!.allowPlayerReferees" class="addAllTeamPRPanel">
        <p-button (click)="addAllTeamPR()" severity="secondary" icon="pi pi-add" label="Add a player for each team" class="table-buttons"></p-button>
        <p-button (click)="addReferee()" icon="pi pi-add" label="Add a referee"></p-button>
      </div>
      <p-table [value]="referees()" stripedRows showGridlines [size]="'small'" tableLayout="fixed">
        <ng-template #header>
            <tr class="tableRowTitle">
              <th style="width:5%" *ngIf="tournament()!.allowPlayerReferees">PR</th>
              <th style="width:20%">First name</th>
              <th style="width:20%">Last Name</th>
              <th style="width:10%">Short Name</th>
              <th style="width:10%">Team</th>
              <th style="width:5%">Level</th>
              <th style="width:5%">Upgrade to</th>
              <th style="width:5%">Category</th>
              <th style="width:5%">Gender</th>
              <th style="width:10%" (click)="addReferee()">
                <i class="pi pi-plus action-add" aria-label="add referee"></i> Add
              </th>
            </tr>
        </ng-template>
        <ng-template #body let-referee let-ri="rowIndex">
            <tr class="tableRowItem">
              <td *ngIf="tournament()!.allowPlayerReferees"><p-toggleswitch [(ngModel)]="referee.isPR" (onChange)="onPRChanged(referee)"/></td>

              <td [pEditableColumn]="referee.person?.firstName" pEditableColumnField="firstName" style="text-align: center;">
                <div *ngIf="referee!.isPR" style="text-align: center;">-</div>
                <p-cellEditor *ngIf="!referee!.isPR">
                  <ng-template #input>
                    <input pInputText type="text" [(ngModel)]="referee.person.firstName" [disabled]="referee!.isPR"
                    minlength="1" maxlength="30" style="width: 15rem;"
                    (paste)="onPasteFirstName($event, ri)" (change)="personChanged(referee)"/>
                    </ng-template>
                  <ng-template #output>{{ referee.person.firstName }}</ng-template>
                </p-cellEditor>
              </td>

              <td [pEditableColumn]="referee.person?.lastName" pEditableColumnField="lastName" style="text-align: center;">
                <div *ngIf="referee!.isPR" style="text-align: center;">-</div>
                <p-cellEditor *ngIf="!referee!.isPR">
                  <ng-template #input>
                    <input pInputText type="text" [(ngModel)]="referee.person.lastName" [disabled]="referee!.isPR"
                      minlength="1" maxlength="30" style="width: 15rem;"
                      (paste)="onPasteLastName($event, ri)"  (change)="personChanged(referee)"/>
                    </ng-template>
                  <ng-template #output>{{ referee.person.lastName }}</ng-template>
                </p-cellEditor>
              </td>

              <td [pEditableColumn]="referee.person?.shortName" pEditableColumnField="shortName" style="text-align: center;">
                <div *ngIf="referee!.isPR" style="text-align: center;">-</div>
                <p-cellEditor *ngIf="!referee!.isPR">
                  <ng-template #input>
                    <input pInputText type="text" [(ngModel)]="referee.person.shortName" [disabled]="referee!.isPR"
                      minlength="3" maxlength="6" style="width: 5rem;"
                      (paste)="onPasteLastName($event, ri)"  (change)="personChanged(referee)"/>
                    </ng-template>
                  <ng-template #output>{{ referee.person.shortName }}</ng-template>
                </p-cellEditor>
              </td>
              <td  [pEditableColumn]="referee.team?.id" pEditableColumnField="team" style="text-align: center;">
                <p-cellEditor *ngIf="referee.isPR">
                  <ng-template #input>
                    <p-select id="team" size="small" [options]="teams()"
                      [(ngModel)]="referee.team" optionLabel="name" optionValue="id"
                      appendTo="body" placeholder="Team" (onChange)="teamSelected(referee, $event.value)">
                      <ng-template let-team #item #selectedItem >
                        <div class="flex items-center gap-2">
                            <div>{{ team.shortName }} {{ team.divisionShortName }})</div>
                        </div>
                      </ng-template>
                    </p-select>
                  </ng-template>
                  <ng-template #output>{{ referee.team?.shortName }} ({{ referee.team?.division.shortName }})</ng-template>
                </p-cellEditor>
              </td>
              <td [pEditableColumn]="referee.attendee.referee.badge" pEditableColumnField="refereeLevel" style="text-align: center;">
                <div *ngIf="referee!.isPR" style="text-align: center;">-</div>
                <p-cellEditor *ngIf="!referee!.isPR">
                  // Referee level selector
                  <ng-template #input>
                    <input pInputText type="number" [(ngModel)]="referee.attendee.referee.badge"
                      [disabled]="referee!.isPR" (paste)="onPasteLevel($event, ri)" (change)="attendeeChanged(referee)"
                      min="0" max="{{referee!.attendee!.referee!.badgeSystem}}"/>
                  </ng-template>
                  <ng-template #output>{{ referee.attendee.referee.badge }}/{{ referee.attendee.referee.badgeSystem }}</ng-template>
                </p-cellEditor>
              </td>
              <td [pEditableColumn]="referee.attendee.referee.upgrade?.badge" pEditableColumnField="refereeUpgrade" style="text-align: center;">
                <span *ngIf="referee!.isPR">-</span>
                <p-cellEditor *ngIf="!referee!.isPR">
                  <ng-template #input>
                    <input pInputText type="number" [(ngModel)]="referee!.attendee!.referee!.upgrade!.badge" style="width: 2rem;"
                      (paste)="onPasteLevel($event, ri)"  (ngModelChange)="upgradeChanged(referee, $event)"
                      min="0" max="{{referee!.attendee!.referee!.upgrade?.badgeSystem || referee!.attendee!.referee!.badgeSystem}}"/>
                  </ng-template>
                  <ng-template #output>{{ referee.attendee.referee.upgrade?.badge }}</ng-template>
                </p-cellEditor>
              </td>
              <td [pEditableColumn]="referee.attendee.referee.category" pEditableColumnField="refereeCategory" style="text-align: center;">
                <div *ngIf="referee!.isPR" style="text-align: center;">-</div>
                <p-cellEditor *ngIf="!referee!.isPR">
                  // Referee Category selector
                  <ng-template #input>
                    <p-select id="refereeCategory" size="small" [options]="refereeCategories"  (change)="attendeeChanged(referee)"
                      [(ngModel)]="referee!.attendee!.referee!.category" appendTo="body" required [disabled]="referee!.isPR"/>
                  </ng-template>
                  <ng-template #output>{{ referee.attendee.referee.category }}</ng-template>
                </p-cellEditor>
              </td>
              <td [pEditableColumn]="referee.person?.gender" pEditableColumnField="gender" style="text-align: center;">
                <div *ngIf="referee!.isPR" style="text-align: center;">-</div>
                <p-cellEditor *ngIf="!referee!.isPR">
                  <ng-template #input>
                    <p-select id="gender" size="small" [options]="genders" [(ngModel)]="referee!.person!.gender"
                      appendTo="body" required [disabled]="referee!.isPR" (change)="attendeeChanged(referee)"/>
                  </ng-template>
                  <ng-template #output>{{ referee.person.gender }}</ng-template>
                </p-cellEditor>
              </td>
              <td style="text-align: center;">
                <i class="pi pi-trash action action-remove" aria-label="remove referee" (click)="removeReferee(referee)"></i>
                <i class="pi pi-pencil action action-edit" aria-label="edit referee" (click)="editReferee(referee)"></i>
              </td>
            </tr>
        </ng-template>
      </p-table>
      <div *ngIf="tournament()!.allowPlayerReferees" class="addAllTeamPRPanel">
        <p-button (click)="addAllTeamPR()" severity="secondary" icon="pi pi-add" label="Add a player for each team" class="table-buttons"></p-button>
        <p-button (click)="addReferee()" icon="pi pi-add" label="Add a referee"></p-button>
      </div>
    </div>
    </div>
    <p-confirmDialog [style]="{width: '40vw'}"></p-confirmDialog>
    `,
  styles: [`
    .tableRowTitle th { text-align: center;}
    .action { font-size: 1.3rem}
    .action-remove { margin-right: 10px; color: red;}
    .action-edit { margin-right: 10px; color: blue;}
    .addAllTeamPRPanel { text-align: right; margin: 10px 0;}
    .table-buttons { margin: 0 10px;}
    `
    ],
  standalone: false
})
export class TournamentRefereeComponent extends AbstractTournamentComponent {

  attendeeService = inject(AttendeeService);
  personService = inject(PersonService);
  regionService = inject(RegionService);
  modalController = inject(ModalController);
  confirmationService = inject(ConfirmationService);

  readonly refereeCategories : RefereeCategory[] = ['J', 'O', 'S', 'M'];
  readonly genders: Gender[] = ['M', 'F'];
  referees = signal<Referee[]>([]);
  teams = signal<Team[]>([]);

  constructor() {
    super();
    effect(() => {
      this.tournament();
      if (this.tournament()) {
        this.loadTeams();
        this.loadReferees();
      }
    });
  }

  private loadTeams() {
    // load the teams for the tournament
    this.teams.update(() => {
      const teams: TeamDivision[] = [];
      this.tournament()!.divisions.forEach((division) => {
        if (division.teams) {
          division.teams.forEach((team) => {
            const td: TeamDivision = { ...team, divisionShortName: division.shortName };
            teams.push(td);
          });
        }
      });
      return teams
    });
  }

  private loadReferees() {
    //find attendees having isReferee = true
    this.attendeeService.findTournamentReferees(this.tournament()!.id).pipe(
      map((attendees) => { // convert attendees to referees
        const referees: Referee[] = attendees.map((attendee: Attendee) => {
          return { attendee, isPR: attendee.isReferee && attendee.isPlayer };
        });
        return referees;
      }),

      // complete the referee attributes
      mergeMap((referees: Referee[]) => {
        let obs: Observable<any>[] = [of('')];
        referees.forEach(referee => {
          if (referee.attendee.player && referee.attendee.player.teamId) {
            //console.log('loading: teamId=', referee.attendee.player.teamId, 'for referee', referee);
            // fetch the team for the referee
            this.tournament()?.divisions.forEach((division) => {
              if (division.teams) {
                division.teams.forEach((team) => {
                  if (team.id === referee.attendee.player!.teamId) {
                    referee.team = team;
                    const t:any = referee.team;
                    t.division = division;
                    // console.log('Team found:', team);
                  }
                });
              }
            });
          }
          if (referee.attendee.personId) {
            // console.log('Loading person: personId=', referee.attendee.personId);
            //load person
            obs.push(this.personService.byId(referee.attendee.personId).pipe(
              map((person: Person|undefined) => {
                if (person) referee.person = person;
                // console.debug('Loaded person: personId=', referee.attendee.personId, person);
                return referee;
              }),
              take(1) // due to the use of the forkJoin operator
            ));
          }
        });
        // return referees after all observables are completed;
        return forkJoin(obs).pipe(map(()=> referees));
      }),
      map(referees => {
        //console.log('data loaded='+JSON.stringify(a));
        this.sortReferees(referees);
        this.referees.set([]);
        setTimeout(() => this.referees.set(referees), 100)

      }),
    ).subscribe()
  }

  private sortReferees(referees: Referee[]) {
    referees.sort((r1,r2) => {
      if (r1.isPR === r2.isPR) {

        if (r1.isPR) { // both referees are Player Referee
          const compareDiv = r1.team!.divisionName.localeCompare(r2.team!.divisionName);
          if (compareDiv !== 0) return compareDiv; // both player referee linked to teams from the different divisions

          // both player referee linked to teams from the same divisions
          return r1.team!.name.localeCompare(r2.team!.name);

        } else { //both referees are Full time referee
          return r1.person!.lastName.localeCompare(r2.person!.lastName);
        }
      } else { // one referee is Player referee whereas the other is Full time referee
        return r1.isPR ? 1 : -1;
      }
    })
  }
  onAllowPlaeyrRefereesChanged() {
    console.debug('onAllowPlaeyrRefereesChanged', this.tournament()!.allowPlayerReferees)
    if (this.tournament()!.allowPlayerReferees) {
      this.onTournamentConfigChanged();
      return;
    }
    // check if there are Player referees as attendee
    const prs: Referee[] = this.referees().filter(referee => referee.isPR);
    console.debug('PRs', prs)
    if (prs.length === 0) return;
    // ask confirmation to the user about removing the player referees
    this.confirmationService.confirm({
      message: 'Do you want to delete the '+prs.length+' player referees?',
      header: 'Danger Zone',
      icon: 'pi pi-exclamation-triangle',
      rejectLabel: 'Cancel',
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true},
      acceptButtonProps: { label: 'Delete', severity: 'danger'},
      accept: () => {
        // The user confirm to remove the player referee attendees
        this.removeReferee(...prs);
        this.onTournamentConfigChanged();
        this.confirmationService.close();
      },
      reject: () => {
        // The user choose to not remove player referees
        this.tournament()!.allowPlayerReferees = true;
        this.confirmationService.close();
      },
    });
  }
  onPRChanged(referee: Referee) {
    if (referee.isPR) {
      referee.attendee.isPlayer = true;
      if (!referee.attendee.player) {
        referee.attendee.player = { teamId: '' };
      }
    } else {
      referee.attendee.isPlayer = false;
      delete referee.attendee.player
    }
    this.attendeeChanged(referee);
  }
  addReferee(team: Team|undefined = undefined) {
    this.referees.update((referees) => {
      return [...referees, this._addReferee(team) ];
    });
  }
  private _addReferee(team: Team|undefined = undefined): Referee {
    const tournamentCuntry = this.regionService.countryById(this.tournament()!.countryId);
    const defaultBadgeSystem: RefereeBadgeSystem = tournamentCuntry?.badgeSystem ? tournamentCuntry.badgeSystem : 5;
    const attendee: Attendee = {
      id: '',
      personId: '',
      tournamentId: this.tournament()!.id,
      isReferee: true,
      isPlayer: false,
      isRefereeCoach: false,
      isTournamentManager: false,
      referee: {
        badge: 0,
        badgeSystem: defaultBadgeSystem,
        category: 'O',
        upgrade : { badge: 0, badgeSystem: defaultBadgeSystem }
      },
      roles: [],
      partDays: [],
      lastChange: 0
    };
    if (team) {
      attendee.isPlayer = true;
      attendee.player = { teamId: team.id }
      this.attendeeService.save(attendee).subscribe()
      return { attendee, isPR: true, team };
    }
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
      referee: {
        badge: 0,
        badgeSystem: defaultBadgeSystem,
        category: 'O',
        upgrade : { badge: 0, badgeSystem: defaultBadgeSystem }
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
    return { attendee, person, isPR: false };
  }


  removeReferee(...refereesToremove: Referee[]) {
      // remove the referee from the list
      const referees = this.referees().filter((r1) =>  refereesToremove.filter(r2 => r1.attendee.id !== r2.attendee.id).length > 0 );
      refereesToremove.forEach(referee => {
        if (referee.attendee.id && this.attendeeService.isOnlyReferee(referee.attendee)) {
          // remove the attendee from the database
          this.attendeeService.delete(referee.attendee.id);
          // Note: Use less person will be removed by daily job

          //TODO remove the referee from the games

        } // else the attendee is not saved yet, so we just remove it from the list
      });
      this.referees.set([]);
      setTimeout(() => this.referees.set(referees), 100);
  }

  async editReferee(referee: Referee) {
    // show a modal to edit the referee
    const modal = await this.modalController.create({
      component: TournamentRefereeEditComponent,
      componentProps: { referee, teams: this.teams(), tournament: this.tournament() },
    });
    modal.onDidDismiss().then(() => {
      this.referees.update(referees => {
        this.attendeeChanged(referee);
        if (!referee.isPR) this.personChanged(referee);
        const idx = referees.findIndex(r => r.attendee.id === referee.attendee.id);
        if (idx >= 0) referees.splice(idx, 1, referee);
        setTimeout(() => this.referees.set(referees), 100);
        return [];
      });
    });
    modal.present();
  }

  teamSelected(referee: Referee, teamId: string) {
    // update the referee with the selected team
    this.referees.update((referees) => {
      referee.team = this.teams().find(t => t.id === teamId);
      console.debug('Link the referee', referee,'to the team', referee.team);
      if (referee.attendee.player) {
        referee.attendee.player.teamId = teamId;
      } else {
        referee.attendee.player = { teamId: teamId, num: -1 };
      }
      this.attendeeChanged(referee);
      return referees;
    });
  }
  attendeeChanged(referee: Referee) {
    console.debug('Saving referee', referee)
    this.attendeeService.save(referee.attendee).subscribe();
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

  personChanged(referee: Referee) {
    const p:Person = referee.person!;
    this.autoComputeShortName(p);
    if (!referee.isPR) this.personService.save(p).subscribe();
  }
  onPasteFirstName(event: any, ri:number) {
    event.preventDefault(); // Empêcher le collage natif
    console.debug('Paste first names : begin');
    const clipboardData = event.clipboardData || (window as any).clipboardData;
    const pastedText = clipboardData.getData('text'); // Récupérer le texte collé
    if (!pastedText) return;
    this.referees.update(referees => {
      // parse clipboard and filter values
      const rows: string[][] = pastedText.split('\n')
        .filter((r:string) => r.trim() !== '')
        .map((r:string) => r.split('\t').filter(c => c.trim().length > 0))
        .filter((r:string[]) => r.length > 0 && r[0].trim().length > 0);
      let refereeIdx = ri;
      rows.forEach((row:string[]) => {
        while(refereeIdx < referees.length && referees[refereeIdx].isPR) refereeIdx++;
        if (refereeIdx === referees.length) {
          referees.push(this._addReferee());
        }
        const referee = referees[refereeIdx];
        if (referee && referee.person && !referee.isPR) {
          let personChanged = false;
          if (row.length > 0 && row[0] && row[0].trim().length > 0) {
            referee.person.firstName  = row[0].trim();
            personChanged = true;
          }
          if (row.length > 1 && row[1] && row[1].trim().length > 0) {
            referee.person.lastName   = row[1].trim();
            personChanged = true;
          }
          if (row.length > 2 && row[2] && row[2].trim().length > 0) {
            referee.person.shortName  = row[2].trim();
            personChanged = true;
          }
          if (row.length === 2) { // paste first and and last Name => try to auto compute short name
            if (this.autoComputeShortName(referee.person)) personChanged = true;
          }
          if (personChanged) {
            this.personChanged(referee);
          }
        }
        refereeIdx++;
      })
      return referees;
    });
  }
  onPasteLastName(event: any, ri:number) {
    event.preventDefault(); // Empêcher le collage natif
    const clipboardData = event.clipboardData || (window as any).clipboardData;
    const pastedText = clipboardData.getData('text'); // Récupérer le texte collé
    if (!pastedText) return;
    this.referees.update(referees => {
      // parse clipboard and filter values
      const rows: string[][] = pastedText.split('\n')
        .filter((r:string) => r.trim() !== '')
        .map((r:string) => r.split('\t').filter(c => c.trim().length > 0))
        .filter((r:string[]) => r.length > 0 && r[0].trim().length > 0);
      let refereeIdx = ri;
      rows.forEach((row:string[]) => {
        while(refereeIdx < referees.length && referees[refereeIdx].isPR) refereeIdx++;
        if (refereeIdx === referees.length) {
          referees.push(this._addReferee());
        }
        const referee = referees[refereeIdx];
        if (referee && referee.person && !referee.isPR) {
          let personChanged = false;
          if (row.length > 0 && row[0] && row[0].trim().length > 0) {
            referee.person.lastName  = row[0].trim();
            personChanged = true;
          }
          if (row.length > 1 && row[1] && row[1].trim().length > 0) {
            referee.person.shortName = row[1].trim();
            personChanged = true;
          }
          if (row.length === 1) { // paste last name => try to auto compute short name
            if (this.autoComputeShortName(referee.person)) personChanged = true;
          }
          if (personChanged) this.personChanged(referee);
        }
        refereeIdx++;
      })
      return referees;
    });
  }
  onPasteLevel(event: any, ri:number) {
    event.preventDefault(); // Empêcher le collage natif
    const clipboardData = event.clipboardData || (window as any).clipboardData;
    const pastedText = clipboardData.getData('text'); // Récupérer le texte collé
    if (!pastedText) return;
    this.referees.update(referees => {
      // parse clipboard and filter values
      const rows: string[][] = pastedText.split('\n')
        .filter((r:string) => r.trim() !== '')
        .map((r:string) => r.split('\t').filter(c => c.trim().length > 0))
        .filter((r:string[]) => r.length > 0 && r[0].trim().length > 0);
      let refereeIdx = ri;
      rows.forEach((row:string[]) => {
        while(refereeIdx < referees.length && referees[refereeIdx].isPR) refereeIdx++;
        if (refereeIdx < referees.length && referees[refereeIdx]
          && row.length > 0 && row[0] && row[0].trim().length > 0) {
          const badge = Number.parseInt(row[0].trim());
          if (!isNaN(badge) && badge >= 0 && badge <= referees[refereeIdx].attendee.referee!.badgeSystem) {
            referees[refereeIdx].attendee.referee!.badge = badge;
            this.attendeeChanged(referees[refereeIdx]);
          }
        }
        refereeIdx++;
      })
      return referees;
    });
  }
  addAllTeamPR() {
    console.log('TODO addAllTeamPR');
    this.teams().forEach(team => {
      // search if there already exists a referee linked to this team.
      const refereeTeam = this.referees().find(referee => referee.isPR && referee.team?.id === team.id);
      if (!refereeTeam) { // no referee linked to this team
        this.addReferee(team);
      }
    });
  }

  upgradeChanged(referee: Referee, value:number) {
    if (referee.attendee.referee)
      referee.attendee.referee.upgrade.badge = value;
    if (referee && referee.person) {
      referee.person.referee = referee.attendee.referee;
    }
    this.attendeeChanged(referee);
  }
}
