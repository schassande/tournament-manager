import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, map, Observable, of, switchMap, take } from 'rxjs';
import { Attendee, Country, defaultSlotType, Division, ModulesNames, Person, Tournament } from '@tournament-manager/persistent-data-model';
import { UserService } from '../service/user.service';
import { TournamentService } from '../service/tournament.service';
import { AttendeeService } from '../service/attendee.service';
import { PersonService } from '../service/person.service';
import { DateService } from '../service/date.service';
import { RegionService } from '../service/region.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TournamentFieldsEditComponent } from '../component/tournament-fields-edit.component';
import { TournamentDaysEditComponent } from '../component/tournament-days-edit.component';
import { SelectModule } from 'primeng/select';
import { MessageModule } from 'primeng/message';
import { TournamentDivisionsEditComponent } from '../component/tournament-divisions-edit.component';
import { TextareaModule } from 'primeng/textarea';
import { InputTextModule } from 'primeng/inputtext';
import { TabsModule } from 'primeng/tabs';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { TOURNAMENT_FEATURES, TournamentFeatureOption } from '../config/tournament-features';

interface ManagerView {
  key: string;
  email: string;
  attendee?: Attendee;
  person?: Person;
}

@Component({
  selector: 'app-tournament-edit',
  standalone: true,
  imports: [ 
    ButtonModule,
    CheckboxModule,
    CommonModule,
    FormsModule, 
    InputTextModule, 
    MessageModule, 
    SelectModule, 
    TabsModule, 
    TextareaModule, 
    TournamentFieldsEditComponent, 
    TournamentDaysEditComponent, 
    TournamentDivisionsEditComponent],
  template: `
  @if (tournament()) {
  <div class="page">

    <div style="margin: 20px; text-align: center;">
      @for(error of errors(); track error) {
        <p-message severity="error">{{ error }}</p-message>
      }
    </div>

    <p-tabs [value]="activeTab()" (valueChange)="tabSelected($event)">
      <p-tablist>
        <p-tab value="general">General</p-tab>
        <p-tab value="fields">Fields</p-tab>
        <p-tab value="days">Days</p-tab>
        <p-tab value="divisions">Divisions and teams</p-tab>
        <p-tab value="managers">Managers</p-tab>
        <p-tab value="features">Features</p-tab>
      </p-tablist>
      <p-tabpanels>
        <p-tabpanel value="general">
          <div class="form-field">
            <label for="name">Name *</label>
            <input id="name" type="text" pInputText [(ngModel)]="tournament()!.name" required (onChange)="nameModified()"/>
          </div>
          <div class="form-field">
            <label for="description">Description</label>
            <textarea id="description" pInputTextarea [(ngModel)]="tournament()!.description" (onChange)="descriptionModified()"></textarea>
          </div>
          <div class="form-field">
            <label for="country">Country *</label>
            <p-select id="description" size="small" [options]="countries" [(ngModel)]="country"
              optionLabel="name" [filter]="true" filterBy="name"
              appendTo="body" placeholder="Country" (onChange)="countrySelected()" />
          </div>
        </p-tabpanel>

        <p-tabpanel value="fields">
          <app-tournament-fields-edit [(fields)]="tournament()!.fields" (fieldsChange)="fieldsChanged()">
          </app-tournament-fields-edit>
        </p-tabpanel>

        <p-tabpanel value="days">
          <app-tournament-days-edit
            [tournament]="tournament()!"
            (dayChange)="onDayChange()"
            (startDateChange)="onTournamentStartDateChange($event)"
            (endDateChange)="onTournamentEndDateChange($event)">
          </app-tournament-days-edit>
        </p-tabpanel>

        <p-tabpanel value="divisions">
      <app-tournament-divisions-edit
        [tournament]="tournament()!" (divisionsChanged)="onDivisionsChanged($event)" >
      </app-tournament-divisions-edit>
        </p-tabpanel>

        <p-tabpanel value="managers">
          <div class="manager-add">
            <label for="managerEmail">Email</label>
            <input id="managerEmail" type="email" pInputText [(ngModel)]="managerEmail"
              (keyup.enter)="addManager()" placeholder="manager@example.com" />
            <button pButton type="button" label="Add" icon="pi pi-plus"
              [disabled]="managerBusy" (click)="addManager()"></button>
          </div>
          <div class="manager-list">
            @for (manager of managers(); track manager.key) {
              <div class="manager-row">
                <span>{{ manager.email }}</span>
                @if (manager.person) {
                  <span>{{ manager.person.firstName }} {{ manager.person.lastName }}</span>
                }
                <button pButton type="button" severity="danger" text="true" icon="pi pi-trash"
                  [attr.aria-label]="'Remove manager ' + manager.email"
                  [disabled]="managerBusy" (click)="removeManager(manager)"></button>
              </div>
            }
          </div>
        </p-tabpanel>

        <p-tabpanel value="features">
          <table class="feature-table">
            <thead>
              <tr><th>Enabled</th><th>Feature</th><th>Description</th></tr>
            </thead>
            <tbody>
              @for (feature of features; track feature.module) {
                <tr>
                  <td>
                    <p-checkbox
                      [inputId]="feature.module"
                      [binary]="true"
                      [ngModel]="isFeatureEnabled(feature.module)"
                      (ngModelChange)="featureChanged(feature.module, $event)" />
                  </td>
                  <td><label [for]="feature.module">{{ feature.name }}</label></td>
                  <td>{{ feature.description }}</td>
                </tr>
              }
            </tbody>
          </table>
        </p-tabpanel>
      </p-tabpanels>
    </p-tabs>
    <div style="height: 100px;"></div>
  </div>
  }
  `,
  styles: [`
    .page {
      margin: 0 auto;
    }
    .form-field {
      margin: 5px 0;
      vertical-align: middle;
    }
    .form-field label {
      display: inline-block;
      width: 150px;
      text-align: right;
      margin-right: 10px;
      vertical-align: top;
    }

    .chapterSection .form-field textarea {
      width: 450px;
      height: 60px;
    }
    .manager-add, .manager-row { display: flex; align-items: center; gap: 10px; margin: 10px 0; }
    .manager-add label { min-width: 80px; }
    .manager-add input { min-width: 280px; }
    .manager-row { max-width: 600px; border-bottom: 1px solid #ddd; padding: 6px 0; }
    .manager-row span:first-child { flex: 1; }
    .manager-row span:nth-child(2) { flex: 1; }
    .feature-table { width: 100%; border-collapse: collapse; }
    .feature-table th, .feature-table td { padding: 8px; border-bottom: 1px solid #ddd; text-align: left; }
    .feature-table th:first-child, .feature-table td:first-child { width: 90px; text-align: center; }
  `],
})
export class TournamentEditComponent  implements OnInit {
  // Services
  private activatedRoute = inject(ActivatedRoute);
  private tournamentService = inject(TournamentService);
  private router = inject(Router);
  private userService = inject(UserService);
  private dateService = inject(DateService);
  private regionService = inject(RegionService);

  // Properties
  tournament = signal<Tournament|null>(null);
  activeTab = signal('general');
  country: Country|undefined;
  countries: Country[] = this.regionService.countries;
  readonly features: TournamentFeatureOption[] = TOURNAMENT_FEATURES;
  errors = signal<string[]>([]);
  managers = signal<ManagerView[]>([]);
  managerEmail = '';
  managerBusy = false;
  constructor() {
    effect(() => {
      const tournament = this.tournament();
      if (tournament) {
        this.country = this.regionService.countryById(tournament.countryId);
      }
    });
  }
  ngOnInit() {
    this.activatedRoute.queryParamMap.subscribe(params => {
      const tab = params.get('tab');
      if (tab && this.tabs.includes(tab)) this.activeTab.set(tab);
    });
    this.userService.currentUser$$.subscribe((currentUser) => {
      if (currentUser) this.init(currentUser);
    });
  }

  /** Updates the active tab and persists it in the page URL. */
  tabSelected(tab: string | number | undefined) {
    if (typeof tab !== 'string' || !this.tabs.includes(tab)) return;
    this.activeTab.set(tab);
    this.router.navigate([], { relativeTo: this.activatedRoute, queryParams: { tab }, queryParamsHandling: 'merge' });
  }

  private readonly tabs = ['general', 'fields', 'days', 'divisions', 'managers', 'features'];

  /** Returns whether a module is enabled for the current tournament. */
  isFeatureEnabled(module: ModulesNames): boolean {
    return this.tournament()?.enablesModules?.includes(module) ?? false;
  }

  /** Updates and immediately persists the tournament module selection. */
  featureChanged(module: ModulesNames, selected: boolean): void {
    this.tournament.update(tournament => {
      if (!tournament) return tournament;
      let modules = (tournament.enablesModules ?? []).filter(item => item !== module);
      if (selected) modules = [...modules, module];
      if (selected && module === 'FIT_IMPORT') modules = modules.filter(item => item !== 'DRAW_DESIGNER');
      if (selected && module === 'DRAW_DESIGNER') modules = modules.filter(item => item !== 'FIT_IMPORT');
      tournament.enablesModules = modules;
      this.save();
      return tournament;
    });
  }

  onDivisionsChanged(divisions: Division[]) {
    this.tournament.update(tournament => {
      tournament!.divisions = divisions;
      this.save();
      return tournament;
    });
  }
  nameModified() {
    this.save();
  }
  descriptionModified() {
    this.save();
  }
  countrySelected() {
    this.tournament.update(tournament => {
      if (!tournament || !this.country) return tournament;
      const region = this.regionService.regionByCountryId(this.country.id);
      if (!region) {
        console.error('Region not found for country: ', tournament.countryId);
        return tournament;
      }
      tournament.countryId = this.country.id;
      tournament.regionId = region.id;
      console.log('Country selected: ', this.country.name + '/'+ region.name);
      this.save();
      return tournament
    });
  }

  fieldsChanged() {
    console.log('TournamentEdit: fieldsChanged', this.tournament()?.fields);
    this.save();
  }

  onTournamentStartDateChange(startDate: number) {
    this.tournament.update(tournament => {
      tournament!.startDate = startDate;
      this.save();
      return tournament;
    });
  }
  onTournamentEndDateChange(endDate: number) {
    this.tournament.update(tournament => {
      tournament!.endDate = endDate;
      this.save();
      return tournament;
    });
  }

  onDayChange() {
    this.tournament.update(tournament => {
      this.save();
      return tournament;
    });
  }

  private save() {
    if (!this.tournament()) return;
    if (!this.checkTournamentBeforeSave(this.tournament()!)) return;
    const id = this.tournament()!.id;
    console.debug('Saving tournament: ', this.tournament());
    this.tournamentService.save(this.tournament()!).subscribe({
      next: (t) => {
        this.tournament.set(t);
        if (id === '') {
          this.router.navigate([`/tournament/${t.id}/edit`]);
        }
      },
      error: (err) => {
        console.error('Error saving tournament: ', err, this.tournament());
      }
    });
  }

  private init(currentUser: Person) {
    const tournamentId = this.activatedRoute.snapshot.paramMap.get('tournamentId') as string;
    if (tournamentId) {
      this.tournamentService.byId(tournamentId).pipe(take(1)).subscribe(t => {
        if (t) {
          t.id = tournamentId;
          this.tournament.set(t);
          this.loadManagers(t);
        } else {
          console.error('Tournament not found: ', tournamentId, t);
          this.router.navigate(['/tournament']);
        }
      });
    } else {
      this.tournament.set(this.buildDefaultTournament(currentUser));
    }
  }


  // ================================================ //
  // =============== INTERNAL METHODS =============== //
  // ================================================ //

  private checkTournamentBeforeSave(tournament: Tournament): boolean {
    this.errors.update(() => {
      const errors = [];
      if (!tournament.name || tournament.name.length <4) errors.push('Tournament name is too short (4 characters minimum)');
      if (!tournament.regionId) errors.push('Tournament region is not defined');
      if (tournament.managerAttendeeIds.length === 0) errors.push('Tournament managers are not defined');
      if (tournament.managerEmails.length === 0) errors.push('Emails of tournament manager are not defined');
      if (!tournament.countryId) errors.push('Tournament country is not defined');
      if (tournament.divisions.length === 0) errors.push('At least one tournament division is required');
      if (tournament.fields.length === 0) errors.push('At least one tournament field is required');
      if (tournament.days.length === 0) errors.push('At least one tournament day is required');
      if (tournament.startDate <= 0) errors.push('Tournament start date is is not defined');
      return errors;
    });
    return this.errors().length === 0;
  }

  /** Adds a manager, keeping the email list and attendee list consistent. */
  addManager() {
    const tournament = this.tournament();
    const email = this.normalizeEmail(this.managerEmail);
    if (!tournament || !email || !this.isValidEmail(email)) {
      this.errors.set(['A valid manager email is required']);
      return;
    }
    if (tournament.managerEmails.includes(email)) {
      this.managerEmail = '';
      return;
    }
    this.managerBusy = true;
    this.personService
      .byEmail(email)
      .pipe(
        switchMap((person) =>
          this.attendeeService.findByEmail(tournament.id, email).pipe(
            switchMap((attendees) =>
              this.ensureManagerAttendee(
                tournament,
                person || {
                  id: '',
                  userAuthId: '',
                  email,
                  firstName: '',
                  lastName: '',
                  shortName: email,
                  countryId: '',
                  regionId: '',
                  lastChange: 0,
                },
                attendees[0],
              ),
            ),
          ),
        ),
      )
      .subscribe({
        next: (result) => {
          result.tournament.managerEmails = Array.from(new Set([...result.tournament.managerEmails, email]));
          this.saveManagerData(result.tournament, result.attendee).subscribe({
            next: () => {
              this.managerBusy = false;
              this.managerEmail = '';
              this.loadManagers(result.tournament);
            },
            error: (err) => {
              this.managerBusy = false;
              console.error('Unable to save manager', err);
            },
          });
        },
        error: (err) => {
          this.managerBusy = false;
          console.error('Unable to add manager', err);
        },
      });
  }

  /** Removes a manager without deleting an existing attendee. */
  removeManager(manager: ManagerView) {
    const tournament = this.tournament();
    if (!tournament) return;
    tournament.managerEmails = tournament.managerEmails.filter((email) => email !== manager.email);
    if (manager.attendee) {
      manager.attendee.isTournamentManager = false;
      manager.attendee.roles = manager.attendee.roles.filter((role) => role !== 'TournamentManager');
      tournament.managerAttendeeIds = tournament.managerAttendeeIds.filter((id) => id !== manager.attendee!.id);
    }
    this.managerBusy = true;
    this.saveManagerData(tournament, manager.attendee).subscribe({
      next: () => {
        this.managerBusy = false;
        this.loadManagers(tournament);
      },
      error: (err) => {
        this.managerBusy = false;
        console.error('Unable to remove manager', err);
      },
    });
  }

  private readonly attendeeService = inject(AttendeeService);
  private readonly personService = inject(PersonService);

  private ensureManagerAttendee(
    tournament: Tournament,
    person: Person,
    attendee?: Attendee,
  ): Observable<{ tournament: Tournament; attendee: Attendee; person: Person }> {
    const managerAttendee: Attendee = attendee ?? {
      id: '',
      lastChange: Date.now(),
      tournamentId: tournament.id,
      person: {
        ...(person.id ? { personId: person.id } : {}),
        countryId: person.countryId,
        firstName: person.firstName,
        lastName: person.lastName ?? '',
        regionId: person.regionId,
        shortName: person.shortName ?? '',
        email: person.email ?? '',
        gender: person.gender ?? 'M',
        phone: person.phone ?? '',
      },
      roles: [],
      isPlayer: false,
      isReferee: false,
      isRefereeCoach: false,
      isTournamentManager: false,
    };
    this.markAsTournamentManager(managerAttendee);
    return of({ tournament, attendee: managerAttendee, person });
  }

  /** Saves display metadata before a possible self-revocation of management rights. */
  private saveManagerData(tournament: Tournament, attendee?: Attendee): Observable<Tournament> {
    return this.tournamentService
      .save(tournament)
      .pipe(switchMap((saved) => (attendee ? this.attendeeService.save(attendee).pipe(map(() => saved)) : of(saved))));
  }

  /** Loads actual manager roles without repairing or granting rights from legacy email lists. */
  private loadManagers(tournament: Tournament): void {
    this.attendeeService
      .findTournamentManager(tournament.id)
      .pipe(
        switchMap((attendees) =>
          attendees.length
            ? forkJoin(
                attendees.map((attendee) => {
                  const email = attendee.person?.email || '';
                  return this.personService.byEmail(email).pipe(map((person) => ({ email, attendee, person })));
                }),
              )
            : of([]),
        ),
      )
      .subscribe({
        next: (entries) => {
          tournament.managerEmails = entries.map((entry) => entry.email).filter(Boolean);
          tournament.managerAttendeeIds = entries.map((entry) => entry.attendee.id);
          this.managers.set(
            entries.map((entry) => ({
              key: entry.attendee.id,
              email: entry.email,
              attendee: entry.attendee,
              ...(entry.person ? { person: entry.person } : {}),
            })),
          );
        },
        error: (error) => console.error('Unable to load managers', error),
      });
  }

  /** Marks an attendee as manager without changing its other roles. */
  private markAsTournamentManager(attendee: Attendee): void {
    attendee.isTournamentManager = true;
    // Some legacy attendees have no roles array yet.
    attendee.roles ??= [];
    if (!attendee.roles.includes('TournamentManager')) attendee.roles.push('TournamentManager');
  }

  private normalizeEmail(email: string): string { 
    return (email ?? '').trim().toLowerCase();
  }
  private isValidEmail(email: string): boolean { 
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); 
  }

  private buildDefaultTournament(currentUser: Person): Tournament {
    const startDateEpoch = this.dateService.setTime(this.dateService.tomorrow(), 9, 0);
    const defaultDuration = 50*60*1000;
    const ts =  [[startDateEpoch, defaultDuration, this.dateService.addMilli(startDateEpoch, defaultDuration)]];
    for(let i=0; i<4; i++) {
      const begin:number = ts[ts.length-1][2]; // end of last timeslot
      ts.push([begin, defaultDuration, this.dateService.addMilli(begin, defaultDuration)]);
    }
    const nowEpoch = new Date().getTime();
    return {
      id: '',
      lastChange: nowEpoch,
      name: 'test',
      description: '',
      startDate: startDateEpoch,
      endDate: startDateEpoch,
      nbDay: 1,
      timeZone: 'UTC+01:00',
      venue: '',
      city: '',
      countryId: '',
      regionId: '',
      fields: [
        { id: '1', name: 'Field 1', video: false, quality: 1, orderView: 1 },
        { id: '2', name: 'Field 2', video: false, quality: 1, orderView: 2 }
      ],
      days: [{
        id: '1',
        date: startDateEpoch,
        parts: [{
          id: '1',
          name: '1',
          dayId: '1',
          timeslots: ts.map((t) => { return {
            id: crypto.randomUUID(),
            start: t[0],
            duration: t[1],
            end: t[2],
            slotType: defaultSlotType,
            playingSlot: true
          }  }),
          allFieldsAvaillable: true,
          availableFieldIds: []
        }]
      }],
      divisions: [
        {
          id:'100', name: 'Mens Open', shortName: 'MO', backgroundColor: 'blue', fontColor: 'white', teams: [
            {id:'101', divisionName: 'Mens Open', name: 'Team MO 1', shortName: 'MO1'},
            {id:'102', divisionName: 'Mens Open', name: 'Team MO 2', shortName: 'MO2'},
            {id:'103', divisionName: 'Mens Open', name: 'Team MO 3', shortName: 'MO3'},
            {id:'104', divisionName: 'Mens Open', name: 'Team MO 4', shortName: 'MO4'},
          ]
        },
        {
          id:'200', name: 'Womens Open', shortName: 'WO', backgroundColor: 'pink', fontColor: 'black', teams: [
            {id:'201', divisionName: 'Mens Open', name: 'Team WO 1', shortName: 'WO1'},
            {id:'202', divisionName: 'Mens Open', name: 'Team WO 2', shortName: 'WO2'},
            {id:'203', divisionName: 'Mens Open', name: 'Team WO 3', shortName: 'wO3'},
            {id:'204', divisionName: 'Mens Open', name: 'Team WO 4', shortName: 'WO4'},
          ]
        },
        {
          id:'300', name: 'Mixed Open', shortName: 'XO', backgroundColor: 'yellow', fontColor: 'black', teams: [
            {id:'301', divisionName: 'Mixed Open', name: 'Team XO 1', shortName: 'XO1'},
            {id:'302', divisionName: 'Mixed Open', name: 'Team XO 2', shortName: 'XO2'},
            {id:'303', divisionName: 'Mixed Open', name: 'Team XO 3', shortName: 'xO3'},
            {id:'304', divisionName: 'Mixed Open', name: 'Team xO 4', shortName: 'XO4'},
          ]
        }
      ],
      managerAttendeeIds :[ currentUser.id ],
      managerEmails :[ currentUser.email],
    };
  }
}
