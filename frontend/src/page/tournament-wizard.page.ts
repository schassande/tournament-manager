import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Attendee, BasicDivisions, Country, defaultSlotType, Division, ModulesNames, Person, Tournament } from '@tournament-manager/persistent-data-model';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { RadioButtonModule } from 'primeng/radiobutton';
import { SelectModule } from 'primeng/select';
import { StepperModule } from 'primeng/stepper';
import { DateService } from '../service/date.service';
import { RegionService } from '../service/region.service';
import { TournamentService } from '../service/tournament.service';
import { UserService } from '../service/user.service';
import { TOURNAMENT_FEATURES, TournamentFeatureOption } from '../config/tournament-features';

type MatchDefinitionMode = 'FIT_IMPORT' | 'DRAW_DESIGNER' | 'MANUAL_IMPORT';

interface TournamentWizardData {
  name: string;
  countryId: string;
  timeZone: string;
  matchDefinitionMode: MatchDefinitionMode;
  isRefereeCoach: boolean | null;
  startDate: Date;
  nbDay: number;
  numberOfFields: number;
  divisions: string[];
  modules: ModulesNames[];
}

/** Modal wizard used to create and initially configure a tournament. */
@Component({
  selector: 'app-tournament-wizard',
  imports: [ButtonModule, CheckboxModule, DatePickerModule, DialogModule, FormsModule, InputNumberModule, InputTextModule, ProgressSpinnerModule, RadioButtonModule, SelectModule, StepperModule],
  templateUrl: './tournament-wizard.page.html',
  styleUrl: './tournament-wizard.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TournamentWizardComponent {
  private readonly router = inject(Router);
  private readonly dateService = inject(DateService);
  private readonly regionService = inject(RegionService);
  private readonly tournamentService = inject(TournamentService);
  private readonly userService = inject(UserService);

  readonly countries: Country[] = this.regionService.countries;
  readonly divisions = [
    ['MO', 'M30', 'M35', 'M40', 'M45', 'M50', 'M55'],
    ['WO', 'W27', 'W35', 'W40'],
    ['XO', 'X30'],
    ['Open'],
  ];
  readonly features: TournamentFeatureOption[] = TOURNAMENT_FEATURES;
  readonly timeZones = ['UTC', 'Europe/Paris', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo', 'Australia/Sydney'];
  readonly wizard = signal<TournamentWizardData>(this.initialData());
  readonly activeStep = signal(1);
  readonly creating = signal(false);
  readonly created = signal(false);
  readonly error = signal<string | null>(null);
  readonly dialogVisible = signal(true);
  readonly currentUser = this.userService.currentUser$;

  /** Moves to the next applicable step after validating the active step. */
  next(): void {
    if (!this.validStep(this.activeStep())) return;
    if (this.activeStep() === 1) {
      this.activeStep.set(this.isFitImport() ? 3 : 2);
    } else if (this.activeStep() === 2) {
      this.activeStep.set(3);
    } else if (this.activeStep() === 3) {
      this.activeStep.set(4);
      this.createTournament();
    }
  }

  /** Returns to the preceding applicable step. */
  previous(): void {
    if (this.activeStep() === 3) this.activeStep.set(this.isFitImport() ? 1 : 2);
    else if (this.activeStep() === 2) this.activeStep.set(1);
  }

  /** Synchronizes the FIT module with the selected match-definition mode. */
  modeChanged(): void {
    const mode = this.wizard().matchDefinitionMode;
    this.wizard.update(data => ({ ...data, modules: this.modulesForMode(data.modules, mode) }));
  }

  /** Applies a match-definition mode and keeps its module selection aligned. */
  updateMode(mode: MatchDefinitionMode): void {
    this.updateField('matchDefinitionMode', mode);
    this.modeChanged();
  }

  /** Enforces the FIT/Draw Designer module exclusivity rule. */
  moduleChanged(module: ModulesNames, selected: boolean): void {
    this.wizard.update(data => {
      let modules = data.modules.filter(item => item !== module);
      if (selected) modules = [...modules, module];
      if (selected && module === 'FIT_IMPORT') modules = modules.filter(item => item !== 'DRAW_DESIGNER');
      if (selected && module === 'DRAW_DESIGNER') modules = modules.filter(item => item !== 'FIT_IMPORT');
      return { ...data, modules };
    });
  }

  /** Updates one scalar field in the wizard state. */
  updateField(field: 'name' | 'countryId' | 'timeZone' | 'matchDefinitionMode' | 'isRefereeCoach' | 'startDate' | 'nbDay' | 'numberOfFields', value: string | number | Date | boolean | null): void {
    this.wizard.update(data => ({ ...data, [field]: value } as TournamentWizardData));
  }

  /** Closes the modal and abandons an unsubmitted wizard. */
  close(): void {
    this.dialogVisible.set(false);
    const tournamentId = this.created() ? this.tournamentService.getCurrentTournament()?.id : undefined;
    if (tournamentId) {
      const mode = this.wizard().matchDefinitionMode;
      const destination = mode === 'FIT_IMPORT' ? 'fit-import' : mode === 'DRAW_DESIGNER' ? 'draw-designer' : 'home';
      void this.router.navigate(['/tournament', tournamentId, destination]);
    } else {
      void this.router.navigate(['/tournament']);
    }
  }

  isFitImport(): boolean { return this.wizard().matchDefinitionMode === 'FIT_IMPORT'; }
  isModuleEnabled(module: ModulesNames): boolean { return this.wizard().modules.includes(module); }
  isDivisionSelected(shortName: string): boolean { return this.wizard().divisions.includes(shortName); }

  /** Updates the selected division list without mutating the signal value. */
  divisionChanged(shortName: string, selected: boolean): void {
    this.wizard.update(data => ({ ...data, divisions: selected ? [...data.divisions, shortName] : data.divisions.filter(item => item !== shortName) }));
  }

  private validStep(step: number): boolean {
    const data = this.wizard();
    if (step === 1) return !!data.name && this.hasValidYear(data.name) && !!data.countryId && !!data.timeZone && !!data.matchDefinitionMode && data.isRefereeCoach !== null;
    if (step === 2) return Number.isInteger(data.nbDay) && data.nbDay >= 1 && data.nbDay <= 10 && Number.isInteger(data.numberOfFields) && data.numberOfFields >= 1 && data.numberOfFields <= 30 && !!data.startDate;
    return true;
  }

  private createTournament(): void {
    if (this.creating() || this.created()) return;
    const user = this.currentUser();
    if (!user || !this.validStep(1) || (!this.isFitImport() && !this.validStep(2))) {
      this.error.set('The connected user or wizard data is invalid.');
      return;
    }
    this.creating.set(true);
    const tournament = this.buildTournament(this.wizard(), user);
    const attendee = this.buildManagerAttendee(tournament, user);
    this.tournamentService.createWithManager(tournament, attendee).subscribe({
      next: () => { this.creating.set(false); this.created.set(true); },
      error: (creationError: unknown) => { this.creating.set(false); this.error.set(creationError instanceof Error ? creationError.message : 'Unable to create the tournament.'); },
    });
  }

  private buildTournament(data: TournamentWizardData, user: Person): Tournament {
    const start = this.dateService.setTime(this.dateService.dateToEpoch(data.startDate), 9, 0);
    const end = this.dateService.addDay(start, data.nbDay - 1);
    const divisions = data.divisions.map((shortName, index) => this.buildDivision(shortName, index));
    const tournament: Tournament = {
      id: '', lastChange: Date.now(), name: data.name.trim(), description: '', startDate: start, endDate: end,
      nbDay: data.nbDay, venue: '', city: '', countryId: data.countryId, regionId: this.regionService.regionByCountryId(data.countryId)?.id ?? '', timeZone: data.timeZone,
      fields: Array.from({ length: data.numberOfFields }, (_, index) => ({ id: `${index + 1}`, name: `${index + 1}`, video: false, quality: 1 as const, orderView: index + 1 })),
      days: Array.from({ length: data.nbDay }, (_, index) => this.buildDay(start, index)), divisions,
      managerAttendeeIds: [], managerEmails: [user.email], enablesModules: data.modules,
    };
    return tournament;
  }

  private buildDay(start: number, dayIndex: number): Tournament['days'][number] {
    const date = this.dateService.addDay(start, dayIndex);
    const slots = Array.from({ length: 5 }, (_, index) => {
      const slotStart = this.dateService.addMilli(this.dateService.setTime(date, 9, 0), index * 50 * 60 * 1000);
      return { id: crypto.randomUUID(), start: slotStart, duration: 50 * 60 * 1000, end: this.dateService.addMilli(slotStart, 50 * 60 * 1000), slotType: defaultSlotType, playingSlot: true };
    });
    const morning = slots.filter(slot => new Date(slot.start * 1000).getHours() < 12);
    const afternoon = slots.filter(slot => new Date(slot.start * 1000).getHours() >= 12);
    return { id: `${dayIndex + 1}`, date, parts: [this.buildPart(`${dayIndex + 1}-morning`, `${dayIndex + 1}-morning`, morning), this.buildPart(`${dayIndex + 1}-afternoon`, `${dayIndex + 1}-afternoon`, afternoon)] };
  }

  private buildPart(id: string, name: string, timeslots: Tournament['days'][number]['parts'][number]['timeslots']): Tournament['days'][number]['parts'][number] {
    return { id, name, dayId: id.split('-')[0], timeslots, allFieldsAvaillable: true, availableFieldIds: [] };
  }

  private buildDivision(shortName: string, index: number): Division {
    const source = BasicDivisions.find(division => division.shortName === shortName);
    const name = source?.name ?? shortName;
    return { id: `division-${index + 1}`, name, shortName, backgroundColor: source?.backgroundColor ?? '#dddddd', fontColor: source?.fontColor ?? '#000000', teams: Array.from({ length: 4 }, (_, teamIndex) => ({ id: `${index + 1}-${teamIndex + 1}`, divisionName: name, name: `Team ${shortName} ${teamIndex + 1}`, shortName: `${shortName}${teamIndex + 1}` })) };
  }

  private buildManagerAttendee(tournament: Tournament, user: Person): Attendee {
    const isCoach = this.wizard().isRefereeCoach === true;
    return { id: '', lastChange: Date.now(), tournamentId: tournament.id, roles: isCoach ? ['TournamentManager', 'Coach'] : ['TournamentManager'], isPlayer: false, isReferee: false, isRefereeCoach: isCoach, isTournamentManager: true, person: { personId: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, shortName: user.shortName, regionId: user.regionId, countryId: user.countryId } };
  }

  private modulesForMode(modules: ModulesNames[], mode: MatchDefinitionMode): ModulesNames[] {
    const withoutMode = modules.filter(module => module !== 'FIT_IMPORT' && module !== 'DRAW_DESIGNER');
    return mode === 'FIT_IMPORT' ? [...withoutMode, 'FIT_IMPORT'] : mode === 'DRAW_DESIGNER' ? [...withoutMode, 'DRAW_DESIGNER'] : withoutMode;
  }

  private hasValidYear(name: string): boolean {
    const current = new Date().getFullYear();
    const years = [current, current + 1, current % 100, (current + 1) % 100];
    return years.some(year => new RegExp(`(^|\\D)${year}($|\\D)`).test(name));
  }

  private initialData(): TournamentWizardData {
    const currentYear = new Date().getFullYear();
    return {
      name: `Tournament ${currentYear}`,
      countryId: '',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      matchDefinitionMode: 'MANUAL_IMPORT',
      isRefereeCoach: null,
      startDate: this.nextSaturday(),
      nbDay: 1,
      numberOfFields: 2,
      divisions: ['XO'],
      modules: [],
    };
  }

  /** Returns the Saturday strictly following today for the default start date. */
  private nextSaturday(): Date {
    const date = new Date();
    const daysUntilSaturday = (6 - date.getDay() + 7) % 7 || 7;
    date.setDate(date.getDate() + daysUntilSaturday);
    return date;
  }
}
