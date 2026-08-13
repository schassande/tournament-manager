import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, map, Observable, of, switchMap } from 'rxjs';
import { Attendee, Country, defaultSlotType, Division, Person, Tournament } from '@tournament-manager/persistent-data-model';
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
      </p-tablist>
      <p-tabpanels>
        <p-tabpanel value="general">
      <div class="form-field">
        <label for="name">Name</label>
        <input id="name" type="text" pInputText [(ngModel)]="tournament()!.name" required />
      </div>
      <div class="form-field">
        <label for="description">Description</label>
        <textarea id="description" pInputTextarea [(ngModel)]="tournament()!.description"></textarea>
      </div>
      <div class="form-field">
        <label for="country">Country</label>
        <p-select id="description" size="small" [options]="countries" [(ngModel)]="country"
          optionLabel="name" [filter]="true" filterBy="name"
          appendTo="body" placeholder="Country" (onChange)="countrySelected()" />
        </div>
        </p-tabpanel>

        <p-tabpanel value="fields">
      <app-tournament-fields-edit
        [(fields)]="tournament()!.fields">
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

    .chapterSection .form-field {
      margin: 5px 0;
      vertical-align: middle;
    }
    .chapterSection .form-field label {
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

  private readonly tabs = ['general', 'fields', 'days', 'divisions', 'managers'];

  onDivisionsChanged(divisions: Division[]) {
    this.tournament.update(tournament => {
      tournament!.divisions = divisions;
      this.save();
      return tournament;
    });
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
      this.tournamentService.byId(tournamentId).subscribe(t => {
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
    this.personService.byEmail(email).pipe(
      switchMap(person => person ? this.attendeeService.findByPerson(tournament.id, person.id).pipe(
        switchMap(attendees => this.ensureManagerAttendee(tournament, person, attendees[0]))
      ) : of({ tournament, attendee: undefined as Attendee|undefined, person }))
    ).subscribe({
      next: result => {
        result.tournament.managerEmails = Array.from(new Set([...result.tournament.managerEmails, email]));
        this.saveManagerData(result.tournament, result.attendee).subscribe({
          next: () => { this.managerBusy = false; this.managerEmail = ''; this.loadManagers(result.tournament); },
          error: err => { this.managerBusy = false; console.error('Unable to save manager', err); }
        });
      },
      error: err => { this.managerBusy = false; console.error('Unable to add manager', err); }
    });
  }

  /** Removes a manager without deleting an existing attendee. */
  removeManager(manager: ManagerView) {
    const tournament = this.tournament();
    if (!tournament) return;
    tournament.managerEmails = tournament.managerEmails.filter(email => email !== manager.email);
    if (manager.attendee) {
      manager.attendee.isTournamentManager = false;
      tournament.managerAttendeeIds = tournament.managerAttendeeIds.filter(id => id !== manager.attendee!.id);
    }
    this.managerBusy = true;
    this.saveManagerData(tournament, manager.attendee).subscribe({
      next: () => { this.managerBusy = false; this.loadManagers(tournament); },
      error: err => { this.managerBusy = false; console.error('Unable to remove manager', err); }
    });
  }

  private readonly attendeeService = inject(AttendeeService);
  private readonly personService = inject(PersonService);

  private ensureManagerAttendee(tournament: Tournament, person: Person, attendee?: Attendee): Observable<{ tournament: Tournament; attendee: Attendee; person: Person }> {
    const managerAttendee: Attendee = attendee ?? {
      id: '', lastChange: Date.now(), tournamentId: tournament.id, personId: person.id,
      roles: [], isPlayer: false, isReferee: false, isRefereeCoach: false, isTournamentManager: false
    };
    this.markAsTournamentManager(managerAttendee);
    return of({ tournament, attendee: managerAttendee, person });
  }

  /**
   * Creates and persists the attendee required for a Person who is listed as
   * tournament manager but does not yet participate in this tournament.
   *
   * The attendee is intentionally created with no other role or restriction.
   * Persisting it here gives the subsequent manager-list reconstruction a real
   * attendee identifier to put into `managerAttendeeIds`.
   */
  private createManagerAttendee(tournament: Tournament, person: Person): Observable<Attendee> {
    return this.ensureManagerAttendee(tournament, person).pipe(
      switchMap(result => this.attendeeService.save(result.attendee))
    );
  }

  private saveManagerData(tournament: Tournament, attendee?: Attendee): Observable<Tournament> {
    const attendeeSave: Observable<Attendee | undefined> = attendee ? this.attendeeService.save(attendee) : of<Attendee | undefined>(undefined);
    return attendeeSave.pipe(switchMap(savedAttendee => {
      if (savedAttendee) {
        tournament.managerAttendeeIds = Array.from(new Set([...tournament.managerAttendeeIds, savedAttendee.id]));
      }
      return this.tournamentService.save(tournament);
    }));
  }

  /**
   * Loads the managers of a tournament, repairs inconsistent persisted data,
   * and builds the view model displayed by the Managers tab.
   *
   * Attendees are queried by tournament identifier. The corresponding persons
   * are then loaded to display their identity and to complete `managerEmails`.
   * Any repair is persisted after the view has been refreshed.
   * @param tournament tournament whose managers must be loaded
   */
  private loadManagers(tournament: Tournament): void {
    this.loadManagerEntries(tournament).subscribe({
      next: entries => this.applyLoadedManagers(tournament, entries),
      error: error => console.error('Unable to load managers', error)
    });
  }

  /**
   * Loads each manager email and resolves its Person and tournament attendee.
   * A missing attendee is created immediately so that the email source and the
   * attendee relation are both complete when the view is built.
   */
  private loadManagerEntries(tournament: Tournament) {
    // managerEmails is authoritative and also includes email-only managers.
    const emails = Array.from(new Set(tournament.managerEmails.map(email => this.normalizeEmail(email))));
    return forkJoin(emails.map(email => this.personService.byEmail(email).pipe(
      switchMap(person => {
        if (person) {
          return this.attendeeService.findByPerson(tournament.id, person.id).pipe(
            switchMap(attendees => attendees[0]
              ? of({ email, person, attendee: attendees[0] })
              : this.createManagerAttendee(tournament, person).pipe(
                map(attendee => ({ email, person, attendee }))
              )
            )
          );
        } else {
          return of({ email, person: null, attendee: undefined });
        }
      })
    )));
  }
  
  /** Applies loaded entries, repairs tournament lists, and refreshes the UI. */
  private applyLoadedManagers(tournament: Tournament, entries: ManagerEntry[]): void {
    // Keep email-only managers in the result, even when no Person exists for them.
    const validEntries = entries.filter(entry => entry.person !== null) as ManagerEntryWithPerson[];
    console.debug('validEntries', validEntries);

    // Every resolved Person should have a manager attendee for this tournament.
    // The helper also repairs a missing TournamentManager role/flag.
    const repairedAttendees = validEntries.filter(entry => entry.attendee !== undefined);
    repairedAttendees.forEach(entry => this.markAsTournamentManager(entry.attendee!));

    // Rebuild the attendee list from the authoritative manager email list,
    // removing stale identifiers and duplicates.
    const attendeeIds = repairedAttendees.map(entry => entry.attendee!.id);
    const emails = entries.map(entry => this.normalizeEmail(entry.email));
    const repairedIds = Array.from(new Set(attendeeIds));
    const existingAttendeeIds = tournament.managerAttendeeIds ?? [];
    const existingEmails = tournament.managerEmails ?? [];

    // Normalize and deduplicate emails while preserving email-only managers.
    const repairedEmails = Array.from(new Set([
      ...existingEmails.map(email => this.normalizeEmail(email)), ...emails
    ]));
    const changed = repairedAttendees.some(entry => !existingAttendeeIds.includes(entry.attendee!.id))
      || JSON.stringify(existingAttendeeIds) !== JSON.stringify(repairedIds)
      || JSON.stringify(existingEmails) !== JSON.stringify(repairedEmails);

    // Persist the repaired, normalized lists before constructing the displayed list.
    tournament.managerAttendeeIds = repairedIds;
    tournament.managerEmails = repairedEmails;

    // Attendee managers display their identity; unresolved emails remain email-only.
    this.managers.set([
      ...validEntries.filter(entry => entry.attendee).map(entry => ({ 
        key: entry.attendee!.id, 
        email: entry.email,
        attendee: entry.attendee, 
        person: entry.person! })),
      // add email not already in valid entries
      ...tournament.managerEmails.filter(email => !validEntries.some(entry => entry.email === email))
        .map(email => ({ key: `email:${email}`, email }))
    ]);
    if (changed) this.persistManagerRepairs(tournament, repairedAttendees.map(entry => entry.attendee!));
  }

  /** Marks an attendee as manager without changing its other roles. */
  private markAsTournamentManager(attendee: Attendee): void {
    attendee.isTournamentManager = true;
    // Some legacy attendees have no roles array yet.
    attendee.roles ??= [];
    if (!attendee.roles.includes('TournamentManager')) attendee.roles.push('TournamentManager');
  }

  /** Persists attendee and tournament corrections found during loading. */
  private persistManagerRepairs(tournament: Tournament, attendees: Attendee[]): void {
    forkJoin([
      ...attendees.filter(attendee => attendee.isTournamentManager).map(attendee => this.attendeeService.save(attendee)),
      this.tournamentService.save(tournament)
    ]).subscribe();
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
          dayId: '1',
          timeslots: ts.map((t,idx) => { return {
            id: (idx+1).toString(),
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
interface ManagerEntry {
  email: string;
  person: Person | null;
  attendee?: Attendee;
}

interface ManagerEntryWithPerson extends ManagerEntry {
  person: Person;
}
