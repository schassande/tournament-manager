import { ListboxModule } from 'primeng/listbox';
import { RegionService } from '../service/region.service';
import { Gender, Referee, RefereeBadgeSystem, RefereeCategory, Team, TeamDivision} from '@tournament-manager/persistent-data-model';
import { Component, effect, inject, signal } from '@angular/core';
import { firstValueFrom, forkJoin, last, map, mergeMap, Observable, of, take, tap } from 'rxjs';
import { Attendee, Person } from '@tournament-manager/persistent-data-model';
import { AttendeeService } from '../service/attendee.service';
import { PersonService } from '../service/person.service';
import { AbstractTournamentPage } from '../component/tournament-abstract.page';
import { ConfirmationService } from 'primeng/api';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogService, DynamicDialogModule } from 'primeng/dynamicdialog';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { FormsModule } from '@angular/forms';
import { TournamentRefereeEditComponent } from '../component/tournament-referee-edit.component';
import { CheckboxModule } from 'primeng/checkbox';
import { SelectModule } from 'primeng/select';
import { IconFieldModule } from 'primeng/iconfield';
import { ref } from 'firebase/storage';
import { RefereeService } from '../service/referee.service';

@Component({
  selector: 'app-tournament-referee',
  template: `<div class="application-page">
  @if (tournament() && referees()) {
    <div class="referee-toolbar">
      <div class="referee-toggle-group">
        <p-toggleswitch [(ngModel)]="tournament()!.allowPlayerReferees" (onChange)="onAllowPlayerRefereesChanged()" class="pr-toggle-switch"></p-toggleswitch>
        <label for="name">Do you use Player Referees?</label>
      </div>
        @if (tournament()!.allowPlayerReferees) {
          <p-button (click)="addAllTeamPR()" severity="info" icon="pi pi-add" label="Add a player referee for each team" class="table-buttons"></p-button>
          <p-button (click)="addTeamReferee()" severity="info" icon="pi pi-add" label="Add a player referee" class="table-buttons"></p-button>
        }
      <div class="referee-actions">
        <p-button (click)="removeAllReferees()" severity="danger" icon="pi pi-trash" label="Delete all referees"
          [disabled]="referees().length === 0" class="table-buttons"></p-button>
        <p-button (click)="addReferee()" icon="pi pi-add" label="Add a full time referee"></p-button>
      </div>
    </div>

    <p-table class="referee-table" [value]="referees()" stripedRows showGridlines [size]="'small'"
      [scrollable]="true" scrollHeight="flex" tableLayout="fixed"
      (paste)="onTablePaste($event)">
      <ng-template #header>
          <tr class="tableRowTitle">
            @if (tournament()!.allowPlayerReferees) {
              <th style="width:5%">PR</th>
            }
            <th style="width:20%">First name</th>
            <th style="width:20%">Last Name</th>
            @if (this.tournament()?.allowPlayerReferees) {
              <th style="width:10%">Team</th>
            }
            <th style="width:10%">Level</th>
            <th style="width:10%">Category</th>
            <th style="width:7%">Up to</th>
            <th style="width:7%">Gender</th>
            <th style="width:10%">Action</th>
          </tr>
      </ng-template>
      <ng-template #body let-referee let-ri="rowIndex">
          <tr class="tableRowItem">
            @if (tournament()!.allowPlayerReferees) {
              <td>
                <p-toggleswitch [(ngModel)]="referee.isPR" (onChange)="onPRChanged(referee)" class="pr-toggle-switch"/>
              </td>
            }

            <td [pEditableColumn]="referee.attendee.person?.firstName" pEditableColumnField="firstName" style="text-align: center;">
              @if (referee!.isPR) {
                <span style="text-align: center;">-</span>
              } @else if (referee?.attendee.person) {
                <p-cellEditor>
                  <ng-template #input>
                    <input pInputText type="text" [(ngModel)]="referee.attendee.person.firstName" [disabled]="referee!.isPR"
                    minlength="1" maxlength="30" style="width: 15rem;"
                    (paste)="onPaste($event, ri, 'FN')" (change)="attendeeChanged(referee)"/>
                    </ng-template>
                  <ng-template #output>{{ referee.attendee.person.firstName }}</ng-template>
                </p-cellEditor>
              }
            </td>
            <td [pEditableColumn]="referee.attendee.person?.lastName" pEditableColumnField="lastName" style="text-align: center;">
              @if (referee!.isPR) {
                <span style="text-align: center;">-</span>
              } @else if (referee?.attendee.person) {
                <p-cellEditor>
                  <ng-template #input>
                    <input pInputText type="text" [(ngModel)]="referee.attendee.person.lastName" [disabled]="referee!.isPR"
                      minlength="1" maxlength="30" style="width: 15rem;"
                      (paste)="onPaste($event, ri, 'LN')"  (change)="attendeeChanged(referee)"/>
                    </ng-template>
                  <ng-template #output>{{ referee.attendee.person.lastName }}</ng-template>
                </p-cellEditor>
              }
            </td>

            @if (this.tournament()?.allowPlayerReferees) {
            <td  [pEditableColumn]="referee.team?.id" pEditableColumnField="team" style="text-align: center;">
              @if (referee!.isPR) {
                <p-cellEditor>
                  <ng-template #input>
                    <p-select id="team" size="small" [options]="teams()" [filter]=true
                      [(ngModel)]="referee.team" optionLabel="name" optionValue="id"
                      appendTo="body" placeholder="Team" (onChange)="teamSelected(referee, $event.value)">
                      <ng-template let-team #item #selectedItem >
                        <div class="flex items-center gap-2">
                            <div>{{ team.divisionShortName }}-{{ team.shortName }}</div>
                        </div>
                      </ng-template>
                    </p-select>
                  </ng-template>
                  <ng-template #output>{{ referee.team?.divisionShortName }}-{{ referee.team?.shortName }} </ng-template>
                </p-cellEditor>
              }
            </td>
            }
            <td [pEditableColumn]="referee.attendee.referee.badge" pEditableColumnField="refereeLevel" style="text-align: center;">
              @if (referee!.isPR) {
                <div style="text-align: center;">-</div>
              } @else {
                <p-cellEditor>
                  // Referee level selector
                  <ng-template #input>
                    <input pInputText type="number" [(ngModel)]="referee.attendee.referee.badge"
                      [disabled]="referee!.isPR" (paste)="onPaste($event, ri, 'CB')" (change)="attendeeChanged(referee)"
                      min="0" max="{{referee!.attendee!.referee!.badgeSystem}}"/>
                  </ng-template>
                  <ng-template #output>{{ referee.attendee.referee.badge }}/{{ referee.attendee.referee.badgeSystem }}</ng-template>
                </p-cellEditor>
              }
            </td>
            <td [pEditableColumn]="referee.attendee.referee.category" pEditableColumnField="refereeCategory" class="full-cell-select-cell" style="text-align: center;">
              @if (referee!.isPR) {
                <div style="text-align: center;">-</div>
              } @else {
                <p-cellEditor>
                  // Referee Category selector
                  <ng-template #input>
                    <select id="refereeCategory" [(ngModel)]="referee!.attendee!.referee!.category"
                      (change)="categoryChanged(referee)" required [disabled]="referee!.isPR" class="full-cell-select"
                      (paste)="onPaste($event, ri, 'CA')" >
                        <option [value]="'J'">Junior</option>
                        <option [value]="'O'">Open</option>
                        <option [value]="'S'">Senior</option>
                        <option [value]="'M'">Master</option>
                    </select>
                  </ng-template>
                  <ng-template #output>{{ toPrintedRefereeCategory(referee.attendee.referee.category) }}</ng-template>
                </p-cellEditor>
              }
            </td>
            <td [pEditableColumn]="referee.attendee.referee.upgrade?.badge" pEditableColumnField="refereeUpgrade" style="text-align: center;">
              @if (referee!.isPR) {
                <span style="text-align: center;">-</span>
              } @else {
                <p-cellEditor>
                  <ng-template #input>
                    <input pInputText type="number" [(ngModel)]="referee!.attendee!.referee!.upgrade!.badge" style="width: 2rem;"
                      (paste)="onPaste($event, ri, 'UB')"  (ngModelChange)="upgradeChanged(referee, $event)"
                      min="0" max="{{referee!.attendee!.referee!.upgrade?.badgeSystem || referee!.attendee!.referee!.badgeSystem}}"/>
                  </ng-template>
                  <ng-template #output>
                    @if (referee.attendee.referee.upgrade?.badge === 0){
                      <span>-</span>
                    } @else {
                      <span>{{ referee.attendee.referee.upgrade?.badge }}</span>
                    }
                  </ng-template>
                </p-cellEditor>
              }
            </td>
            <td [pEditableColumn]="referee.attendee.person?.gender" pEditableColumnField="gender" class="full-cell-select-cell" style="text-align: center;">
              @if (referee!.isPR) {
                <div style="text-align: center;">-</div>
              } @else if (referee?.attendee.person) {
                <p-cellEditor>
                  <ng-template #input>
                    <select id="gender" [(ngModel)]="referee!.attendee.person!.gender"
                      (change)="attendeeChanged(referee)" [disabled]="referee!.isPR" class="full-cell-select"
                      (paste)="onPaste($event, ri, 'G')" >
                        <option [value]="'M'">Male</option>
                        <option [value]="'F'">Female</option>
                    </select>
                  </ng-template>
                  <ng-template #output>
                    @if (referee?.attendee.person) {
                      {{ toPrintedGender(referee.attendee.person.gender) }}
                    }
                  </ng-template>
                </p-cellEditor>
              }
            </td>
            <td style="text-align: center;">
              <i class="pi pi-trash action action-remove" aria-label="remove referee" (click)="removeReferee(referee)"></i>
              <i class="pi pi-pencil action action-edit" aria-label="edit referee" (click)="editReferee(referee)"></i>
            </td>
          </tr>
      </ng-template>
    </p-table>

  }
  <p-confirmDialog [style]="{width: '40vw'}"></p-confirmDialog>
  </div>`,
  styles: [`
    .referee-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 5px;
    }
    .application-page {
      display: flex;
      flex-direction: column;
      position: fixed;
      top: 60px;
      right: 0;
      bottom: 0;
      left: 0;
      box-sizing: border-box;
      overflow: hidden;
    }
    .referee-table {
      flex: 1 1 auto;
      min-height: 0;
    }
    .referee-toggle-group,
    .referee-actions {
      display: flex;
      align-items: center;
    }
    .referee-toggle-group label { margin-left: 10px; }
    .referee-actions { margin-left: auto; }
    .tableRowTitle th { text-align: center;}
    .action { font-size: 1.3rem}
    .action-remove { margin-right: 10px; color: red;}
    .action-edit { margin-right: 10px; color: blue;}
    .buttonPanel { float: right;}
    .table-buttons { margin: 0 10px;}
    td.p-editable-column { padding: 0; }
    td.p-editable-column p-celleditor {
      display: block;
      width: 100%;
      height: 100%;
    }
    td.p-editable-column p-celleditor input,
    td.p-editable-column p-celleditor p-select,
    td.p-editable-column p-celleditor select {
      display: block;
      width: 100% !important;
      height: 100%;
      min-height: 2rem;
      box-sizing: border-box;
    }
    .full-cell-select {
      height: 100%;
    }
    .pr-toggle-switch {
      --p-toggleswitch-checked-background: var(--p-info-color);
    }
    `
    ],
  standalone: true,
  imports: [
    ButtonModule,
    CheckboxModule,
    ConfirmDialogModule,
    DynamicDialogModule,
    FormsModule,
    IconFieldModule,
    InputTextModule,
    ListboxModule,
    TableModule,
    ToggleSwitchModule,
    SelectModule
]

})
export class TournamentRefereeComponent extends AbstractTournamentPage {

  attendeeService = inject(AttendeeService);
  personService = inject(PersonService);
  refereeService = inject(RefereeService);
  regionService = inject(RegionService);
  confirmationService = inject(ConfirmationService);
  dialogService = inject(DialogService);

  readonly refereeCategories : RefereeCategory[] = ['J', 'O', 'S', 'M'];
  readonly genders: Gender[] = ['M', 'F'];
  referees = signal<Referee[]>([]);
  teams = signal<Team[]>([]);

  constructor() {
    super();
    effect(() => {
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
      map((attendees) => { 
        // convert attendees to referees
        const referees: Referee[] = attendees.map((attendee: Attendee) => {
          return { attendee, isPR: attendee.isReferee && attendee.isPlayer };
        });
        // complete the referee attributes when it is player referee
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
        });
        this.sortReferees(referees);
        this.referees.set(referees);
      }),
    ).subscribe()
  }

  private sortReferees(referees: Referee[]) {
    referees.sort((r1,r2) => {
      if (r1.isPR === r2.isPR) {

        if (r1.isPR && r1.team && r2.team) { // both referees are Player Referee
          const compareDiv = r1.team!.divisionName.localeCompare(r2.team!.divisionName);
          if (compareDiv !== 0) return compareDiv; // both player referee linked to teams from the different divisions

          // both player referee linked to teams from the same divisions
          return r1.team!.name.localeCompare(r2.team!.name);

        } else { //both referees are Full time referee
          if (r1.attendee.person && r2.attendee.person) {
            return r1.attendee.person.lastName.localeCompare(r2.attendee.person.lastName);
          } else {
            return 0;
          }
        }
      } else { // one referee is Player referee whereas the other is Full time referee
        return r1.isPR ? 1 : -1;
      }
    })
  }

  protected onAllowPlayerRefereesChanged() {
    // console.debug('onAllowPlaeyrRefereesChanged', this.tournament()!.allowPlayerReferees)
    if (this.tournament()!.allowPlayerReferees) {
      this.onTournamentConfigChanged();
      return;
    }
    // the user decided to unallow Player referees.
    
    // check if there are Player referees as attendee
    const prs: Referee[] = this.referees().filter(referee => referee.isPR);
    // console.debug('PRs', prs)
    if (prs.length === 0) {
      this.onTournamentConfigChanged();
      return;
    }
    // ask confirmation to the user about removing the player referees
    this.confirmationService.confirm({
      message: 'Do you want to delete the '+prs.length+' player referees?',
      header: 'Danger Zone',
      icon: 'pi pi-exclamation-triangle',
      rejectLabel: 'Cancel',
      acceptLabel: 'Delete',
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
        this.onTournamentConfigChanged();
        this.confirmationService.close();
      },
    });
  }

  protected onPRChanged(referee: Referee) {
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
  protected addReferee(team: Team|undefined = undefined) {
    this.createReferee(team).then(referee => {
      this.referees.update((referees) => {
        return [...referees,  referee];
      });
    });
  }
  private createReferee(
    team: Team|undefined = undefined,
    pastedData: PersonPastedData|undefined = undefined): Promise<Referee> {
    if (!this.tournament()!.defaultRefereeBadgeSystem) {
      const tournamentCountry = this.regionService.countryById(this.tournament()!.countryId);
      this.tournament()!.defaultRefereeBadgeSystem = tournamentCountry?.badgeSystem ?? 5;
    }
    //console.log('createReferee, pastedData=', pastedData);
    const attendee: Attendee = {
      id: '',
      tournamentId: this.tournament()!.id,
      isReferee: true,
      isPlayer: false,
      isRefereeCoach: false,
      isTournamentManager: false,
      referee: {
        badge: pastedData?.currentBadge ?? 0,
        badgeSystem: (pastedData?.currentBadgeSystem ?? this.tournament()!.defaultRefereeBadgeSystem! ?? 5) as RefereeBadgeSystem,
        category: pastedData?.category ?? 'O',
      },
      roles: [],
      lastChange: 0
    };

    if (pastedData?.upgradePlusOne ) {
      pastedData.upgradeBadge = Math.min(attendee.referee!.badge + 1, attendee.referee!.badgeSystem);
      //console.log('createReferee upgradePlusOne', pastedData);
    }

    if (pastedData?.upgradeBadge != undefined && pastedData.upgradeBadge >= 0)  {
      attendee.referee!.upgrade = { 
        badge: pastedData?.upgradeBadge ?? 0, 
        badgeSystem: (pastedData?.upgradeBadgeSystem ?? this.tournament()!.defaultRefereeCoachBadgeSystem! ?? 5) as RefereeBadgeSystem,
      }
      //console.log('createReferee upgradeBadge', attendee.referee);
    }

    if (team) { // Player referee
      attendee.isPlayer = true;
      attendee.player = { teamId: team.id }
      return firstValueFrom(this.attendeeService.save(attendee).pipe(
        map((att) => { return { attendee: att, isPR: true, team }; } )
      ));
    } else { // Full time referee
      attendee.person = {
        firstName: pastedData?.firstName ?? '',
        lastName: pastedData?.lastName ?? '',
        gender: pastedData?.gender ?? 'M',
        shortName: '',
        regionId: this.tournament()!.regionId,
        countryId: this.tournament()!.countryId
      };
      this.autoComputeShortName(attendee);
      return firstValueFrom(this.attendeeService.save(attendee).pipe(
        map((att) => { return { attendee: att, isPR: false }; } )
      ));
    }
  }

  /**
   * Removes the selected referee roles, deleting attendees that have no other role.
   */
  async removeReferee(...refereesToremove: Referee[]) {
    // remove the referee from the list
    const referees = this.referees().filter((referee) =>
      !refereesToremove.some(refereeToRemove => referee.attendee.id === refereeToRemove.attendee.id)
    );
    this.referees.set([...referees]);

    // Delete the attendee or the Refere role of each referee
    await Promise.all(refereesToremove.map(async referee => {
      if (referee.attendee.id) {
        if (this.attendeeService.isOnlyReferee(referee.attendee)) {
          // remove the attendee from the database
          await this.attendeeService.delete(referee.attendee.id);
        } else {
          // remove the role and save the change in the database
          referee.attendee.isReferee = false;
          referee.attendee.roles = referee.attendee.roles.filter(r => r !== 'Referee');
          await this.attendeeService.save(referee.attendee);
        }
        //TODO remove the referee from the allocation, upgrades, ranking ...
      } // else the attendee is not saved yet, so we just remove it from the list
    }));
  }

  /**
   * Ask for confirmation before removing every referee currently attached to the tournament.
   */
  removeAllReferees(): void {
    const refereesToRemove = this.referees();
    if (refereesToRemove.length === 0) {
      return;
    }

    this.confirmationService.confirm({
      message: `Do you want to delete all ${refereesToRemove.length} referees?`,
      header: 'Danger Zone',
      icon: 'pi pi-exclamation-triangle',
      rejectLabel: 'Cancel',
      acceptLabel: 'Delete all',
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
      acceptButtonProps: { label: 'Delete all', severity: 'danger' },
      accept: () => {
        void this.removeReferee(...refereesToRemove);
        this.confirmationService.close();
      },
      reject: () => this.confirmationService.close()
    });
  }

  async editReferee(referee: Referee) {
    // show a modal to edit the referee
    const ref = this.dialogService.open(TournamentRefereeEditComponent, {
      header: 'Find or edit a referee',
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
        referee,
        teams: this.teams(),
        tournament: this.tournament()
      }
    });
    ref.onClose.subscribe(() => {
      this.referees.update(referees => {
        const idx = referees.findIndex(r => r.attendee.id === referee.attendee.id);
        if (idx >= 0) {
          // replace element in the list
          referees.splice(idx, 1, referee);
          this.attendeeChanged(referee); // Async save
          return [...referees];
        } else {
          // return the same array because no change
          return referees;
        }
      });
    });
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
      return [...referees];
    });
  }
  attendeeChanged(referee: Referee) {
    this.autoComputeShortName(referee.attendee);
    this.attendeeService.save(referee.attendee).subscribe();
  }
  autoComputeShortName(attendee: Attendee): boolean {
    if (attendee.person) {
      const p = attendee.person;
      if (!p.shortName && p.firstName.length > 0 && p.lastName.length > 1) {
        p.shortName =
          p.firstName.substring(0, 1).toUpperCase()
          + p.lastName.substring(0, 1).toUpperCase()
          + p.lastName.substring(p.lastName.length-1, p.lastName.length).toUpperCase();
        return true;
      }
    }
    return false;
  }
  async onPaste(event: any, ri:number|undefined, col: 'FN'|'LN'|'CB'|'CA'|'UB'|'G' = 'FN') {
    event.preventDefault(); // Empêcher le collage natif
    // console.debug('Paste first names : begin');
    const clipboardData = event.clipboardData || (window as any).clipboardData;
    const pastedText = clipboardData.getData('text'); // Récupérer le texte collé
    if (!pastedText) return;
    const rows: string[][] = pastedText.split('\n') // split by row
      .filter((r:string) => r.trim().length > 0) // ignore empty lines
      .map((r:string) => r.split('\t').map(c => c.trim())) // split by column
      .filter((r:string[]) => r.length > 0); // ignore empty line
    
      // parse clipboard and filter values
    const referees = this.referees();
    let refereeIdx = ri ?? referees.length;
    const initialSize = this.referees().length;
    await Promise.allSettled(rows.map(async(row:string[]) => {
      // extract data
      const pastedData: PersonPastedData = {};
      if (col === 'FN') {
        this.parseFromFirstName(row, 0, pastedData);
      } else if (col === 'LN') {
        this.parseFromLastName(row, 0, pastedData);
      } else if (col === 'CB') {
        this.parseFromBadge(row, 0, pastedData);
      } else if (col === 'CA') {
        this.parseFromCategory(row, 0, pastedData);
      } else if (col === 'UB') {
        this.parseFromUpgrade(row, 0, pastedData);
      } else if (col === 'G') {
        this.parseFromGender(row, 0, pastedData);
      }
      // console.debug('paste', row, pastedData);
      if (pastedData.firstName && pastedData.lastName 
        && referees.find(ref => ref.attendee.person 
          && ref.attendee.person.firstName === pastedData.firstName 
          && ref.attendee.person.lastName === pastedData.lastName)) {
        return; // ignore
      }

      if (refereeIdx >= initialSize) {
        // add a new full time referee with the data
        referees.push(await this.createReferee(undefined, pastedData));
      } else {
        // update the current referee line

        // => become a full time referee
        referees[refereeIdx].isPR = false;
        referees[refereeIdx].team = undefined;

        this.pasteOnExistingAttendee(referees[refereeIdx].attendee, pastedData);
      }
      refereeIdx++; // move to next row
    }));
    // when all referee are added, update the signal/view
    this.referees.set([...referees]);
  }

  /**
   * Captures a paste on the table when no cell editor owns the event.
   *
   * Paste events emitted by an active cell editor are ignored here because
   * the editor-specific handlers above already process them.
   */
  onTablePaste(event: ClipboardEvent): void {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('td.p-cell-editing')) {
      return;
    }
    this.onPaste(event, undefined, 'FN');
  }


  pasteOnExistingAttendee(attendee: Attendee, pastedData: PersonPastedData) {
    // console.log('pasteOnExistingAttendee begin', attendee, pastedData);
    // badge levels
    if (pastedData.currentBadge != undefined) {
      attendee.referee!.badge = pastedData.currentBadge;
      // console.log('Set badge', pastedData.currentBadge);
      if (pastedData.currentBadgeSystem != undefined) {
        attendee.referee!.badgeSystem = pastedData.currentBadgeSystem as RefereeBadgeSystem;
        // console.log('Set badge system', pastedData.currentBadgeSystem);
      }
    }
    if (pastedData.upgradeBadge !== undefined) {
      // console.log('Set upgrade', pastedData.upgradeBadge);
      if (!attendee.referee!.upgrade) attendee.referee!.upgrade = { badge: 0, badgeSystem: 5 }
      attendee.referee!.upgrade!.badge = pastedData.upgradeBadge;
      if (pastedData.upgradeBadgeSystem !== undefined) {
        attendee.referee!.upgrade!.badgeSystem = pastedData.upgradeBadgeSystem as RefereeBadgeSystem;
        // console.log('Set upgrade system', pastedData.upgradeBadgeSystem);
      }
    } else if (pastedData.upgradePlusOne) {
      if (!attendee.referee!.upgrade) attendee.referee!.upgrade = { badge: 0, badgeSystem: 5 }
      attendee.referee!.upgrade!.badge = attendee.referee!.badge + 1;
      attendee.referee!.upgrade!.badgeSystem = attendee.referee!.badgeSystem
      // console.log('Set upgrade +1', attendee.referee!.upgrade!.badge, attendee.referee!.upgrade!.badgeSystem);
    }
    //person fields
    if (attendee.person) {
        console.log('override person fields');
      // override first name and last name if defined
      if (pastedData.firstName) {
        // console.log('Set firstName', pastedData.firstName);
        attendee.person!.firstName = pastedData.firstName;
      }
      if (pastedData.lastName) {
        // console.log('Set firstName', pastedData.firstName);
        attendee.person!.lastName = pastedData.lastName;
      }
    } else {
      // console.log('override person fields');
      // create the person
      attendee.person = {
        firstName: pastedData.firstName ?? '',
        lastName: pastedData.lastName ?? '',
        gender: pastedData.gender ?? 'M',
        shortName: '',
        regionId: this.tournament()!.regionId,
        countryId: this.tournament()!.countryId
      }
    }
    // console.log('pasteOnExistingAttendee end', attendee, pastedData);
  }

  parseFromFirstName(row: string[], startIdx:number = 0, pastedData: PersonPastedData) {
    if (row.length <= startIdx) return;
    if (row[startIdx].length > 0) {
      //console.debug('parseFromFirstName', row, startIdx, pastedData);
      pastedData.firstName = row[startIdx];    
    }
    this.parseFromLastName(row, startIdx + 1, pastedData);
  }
  parseFromLastName(row: string[], startIdx:number = 0, pastedData: PersonPastedData) {
    if (row.length <= startIdx) return;
    if (row[startIdx].length > 0) {
      //console.debug('parseFromLastName', row, startIdx, pastedData);
      pastedData.lastName = row[startIdx];    
    }
    this.parseFromBadge(row, startIdx + 1, pastedData);
  }
  parseFromBadge(row: string[], startIdx:number = 0, pastedData: PersonPastedData) {
    if (row.length <= startIdx) return;
    if (row[startIdx].length > 0) {
      //console.debug('parseFromBadge', row, startIdx, pastedData);
      const parsedLevel = this.refereeService.parseLevel(row[startIdx])
      pastedData.currentBadge = parsedLevel.badge;
      if (parsedLevel.system) pastedData.currentBadgeSystem = parsedLevel.system;
    }
    this.parseFromCategory(row, startIdx+1, pastedData);
  }
  parseFromCategory(row: string[], startIdx:number = 0, pastedData: PersonPastedData) {
    if (row.length <= startIdx) return;
    if (row[startIdx].length > 0) {
      //console.debug('parseFromCategory', row, startIdx, pastedData);
      const parsedLevel = this.refereeService.parseLevel(row[startIdx])
      if (parsedLevel.category) {
        pastedData.category = parsedLevel.category;
      }
    }
    this.parseFromUpgrade(row, startIdx+1, pastedData);
  }
  parseFromUpgrade(row: string[], startIdx:number = 0, pastedData: PersonPastedData) {
    if (row.length <= startIdx) return;
    if (row[startIdx].length > 0) {
      //console.debug('parseFromUpgrade', row, startIdx, pastedData);
      if ('*' === row[startIdx] || 'YES' === row[startIdx].toUpperCase() || 'Y' === row[startIdx].toUpperCase()) {
        pastedData.upgradePlusOne = true;
      } else {
        const parsedLevel = this.refereeService.parseLevel(row[startIdx]);
        pastedData.upgradeBadge = parsedLevel.badge;
        if (parsedLevel.system) pastedData.upgradeBadgeSystem = parsedLevel.system;
      }
    }
    this.parseFromGender(row, startIdx+1, pastedData);
  }
  parseFromGender(row: string[], startIdx:number = 0, pastedData: PersonPastedData) {
    if (row.length <= startIdx) return;
    if (row[startIdx].length > 0) {
      //console.debug('parseFromGender', row, startIdx, pastedData);
      if ('M' === row[startIdx] || 'MALE' === row[startIdx].toUpperCase() || 'H' === row[startIdx].toUpperCase() || 'Homme' === row[startIdx].toUpperCase()) {
        pastedData.gender = 'M'
      } else if ('F' === row[startIdx] || 'FEMALE' === row[startIdx].toUpperCase() || 'Femme' === row[startIdx].toUpperCase()) {
        pastedData.gender = 'F'
      }
    }
  }

  addTeamReferee() {
    this.teams().find(team => {
      // search if there already exists a referee linked to this team.
      const refereeTeam = this.referees().find(referee => referee.isPR && referee.team?.id === team.id);
      if (!refereeTeam) { // no referee linked to this team
        this.addReferee(team);
        return true;
      }
      return false;
    });
  }

  addAllTeamPR() {
    this.teams().forEach(team => {
      // search if there already exists a referee linked to this team.
      const refereeTeam = this.referees().find(referee => referee.isPR && referee.team?.id === team.id);
      if (!refereeTeam) { // no referee linked to this team
        this.addReferee(team);
      }
    });
  }


  upgradeChanged(referee: Referee, value:number) {
    if (referee.attendee.referee) {
      referee.attendee.referee.upgrade!.badge = value;
      this.attendeeChanged(referee);
    }
  }
  categoryChanged(referee: Referee) {
    this.attendeeChanged(referee);
  }
  toPrintedRefereeCategory(category: RefereeCategory) {
    switch(category) {
      case  'J': return 'Junior';
      case  'O': return 'Open';
      case  'S': return 'Senior';
      case  'M': return 'MAster';
    }
  }
  toPrintedGender(g: Gender) {
    switch(g) {
      case 'F': return 'Female';
      case 'M': return 'Male';
    }
  }
}
interface PersonPastedData {
  firstName?: string; // first name of the person
  lastName?: string; // name of the person
  currentBadge?: number; // badge
  currentBadgeSystem?: number; // badge
  upgradeBadge?: number; // badge
  upgradeBadgeSystem?: number; // badge
  upgradePlusOne?: boolean;
  category?: RefereeCategory;
  gender?: Gender;
}
  
