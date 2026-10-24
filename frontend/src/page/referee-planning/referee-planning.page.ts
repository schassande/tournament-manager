import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, take } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import {
  Attendee,
  Day,
  Field,
  FragmentRefereeAllocation,
  Game,
  GameAttendeeAllocation,
  RefereeBadgeColors,
  isReferee,
  isRefereeCoach,
  TournamentRefereeAllocation,
  WaterCarrierPlanning,
} from '@tournament-manager/persistent-data-model';
import { WaterCarrierComponent } from '../../component/water-carrier/water-carrier.component';
import { WaterCarrierService } from '../../service/water-carrier.service';
import { CoachesPlanningComponent } from '../../component/coaches-planning.component';
import { RefereesListComponent } from '../../component/referees-list.component';
import { RefereesPlanningComponent } from '../../component/referees-planning.component';
import { AbstractTournamentPage } from '../../component/tournament-abstract.page';
import { AttendeeService } from '../../service/attendee.service';
import { FragmentRefereeAllocationService } from '../../service/fragment-referee-allocation.service';
import { GameAttendeeAllocationService } from '../../service/game-attendee-allocation.service';
import { GameService } from '../../service/game.service';
import { attendeeName, isAvailable, PlanningGame, PlanningScope } from '../../service/referee-planning-model';
import { TournamentRefereeAllocationService } from '../../service/tournament-referee-allocation.service';
import { UserService } from '../../service/user.service';

/** Displays published referee/coach planning and water-carrier self-allocation. */
@Component({
  selector: 'app-referee-planning',
  imports: [
    ButtonModule,
    CoachesPlanningComponent,
    FormsModule,
    RefereesListComponent,
    RefereesPlanningComponent,
    SelectModule,
    SelectButtonModule,
    WaterCarrierComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './referee-planning.page.html',
  styleUrl: './referee-planning.page.css',
})
export class RefereePlanningComponent extends AbstractTournamentPage {
  private readonly attendeeService = inject(AttendeeService);
  private readonly fragmentService = inject(FragmentRefereeAllocationService);
  private readonly gameService = inject(GameService);
  private readonly allocationService = inject(GameAttendeeAllocationService);
  private readonly tournamentAllocationService = inject(TournamentRefereeAllocationService);
  private readonly userService = inject(UserService);
  private readonly waterService = inject(WaterCarrierService);
  private readonly route = inject(ActivatedRoute);
  private readonly routeParams = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  private readonly routeTournamentId = computed(() => this.routeParams().get('tournamentId'));
  private requestedTournamentId = '';
  private loadVersion = 0;
  readonly waterPlanning = signal<WaterCarrierPlanning | null>(null);
  readonly waterEnabled = computed(
    () =>
      this.tournament()?.enablesModules?.some(
        (module) => module === 'ONLINE_WATER_CARRIER' || module === 'PRINTED_WATER_CARRIER',
      ) === true,
  );
  readonly loading = signal(false);
  readonly error = signal('');
  readonly tab = signal<'referees' | 'list' | 'coaches' | 'water'>('referees');
  readonly tabOptions = computed(() => [
    ...(this.userService.currentUser$() || !this.waterEnabled()
      ? [
          { label: 'Referees Planning', value: 'referees' as const },
          { label: 'Referees List', value: 'list' as const },
        ]
      : []),
    ...(this.canAccessCoaches() ? [{ label: 'Coaches', value: 'coaches' as const }] : []),
    ...(this.waterEnabled() ? [{ label: 'Water Carrier', value: 'water' as const }] : []),
  ]);
  readonly scopes = signal<PlanningScope[]>([]);
  readonly selectedScopeId = signal('');
  readonly availableReferees = signal<Attendee[]>([]);
  private readonly loadedAttendees = signal<Attendee[]>([]);
  readonly availableCoaches = signal<Attendee[]>([]);
  readonly games = signal<PlanningGame[]>([]);
  readonly attendeeNames = signal<Record<string, string>>({});
  readonly attendeeLevels = signal<Record<string, string>>({});
  readonly attendeeBadgeColors = signal<Record<string, { backgroundColor: string; color: string }>>({});
  readonly selectedScope = computed(() => this.scopes().find((scope) => scope.id === this.selectedScopeId()));
  readonly canAccessCoaches = computed(() => {
    const user = this.userService.currentUser$();
    const tournament = this.tournament();
    if (this.tab() === 'water') return !!user && this.waterPlanning()?.actor?.isCoach === true;
    return (
      !!user &&
      !!tournament &&
      this.loadedAttendees().some(
        (attendee) =>
          attendee.tournamentId === tournament.id &&
          attendee.person?.email?.trim().toLowerCase() === user.email?.trim().toLowerCase() &&
          attendee.isRefereeCoach,
      )
    );
  });

  /** Reloads the appropriate source when the tournament or authenticated application profile changes. */
  constructor() {
    super();
    effect(() => {
      const tournament = this.tournament();
      const routeTournamentId = this.routeTournamentId();
      this.userService.currentUser$();
      if (routeTournamentId && tournament?.id !== routeTournamentId) {
        untracked(() => this.loadRouteTournament(routeTournamentId));
        return;
      }
      if (tournament)
        untracked(() => {
          this.tab.set(this.userService.currentUser$() || !this.waterEnabled() ? 'referees' : 'water');
          this.selectedScopeId.set('');
          this.waterPlanning.set(null);
          this.load();
        });
    });
    effect(() => {
      if (!this.loading() && !this.canAccessCoaches() && this.tab() === 'coaches') {
        this.tab.set('referees');
      }
    });
  }

  /** Loads the current tournament's visible planning data. */
  load(): void {
    const tournament = this.tournament();
    const routeTournamentId = this.routeTournamentId();
    if (routeTournamentId && tournament?.id !== routeTournamentId) {
      this.loadRouteTournament(routeTournamentId);
      return;
    }
    if (!tournament) return;
    if (this.tab() === 'water') {
      void this.loadWaterPlanning(tournament.id);
      return;
    }
    const version = ++this.loadVersion;
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      attendees: this.attendeeService.findByTournament(tournament.id).pipe(take(1)),
      fragments: this.fragmentService.byTournament(tournament.id).pipe(take(1)),
      games: this.gameService.byTournament(tournament.id).pipe(take(1)),
      allocations: this.allocationService.byTournament(tournament.id).pipe(take(1)),
      tournamentAllocations: this.tournamentAllocationService.byTournament(tournament.id).pipe(take(1)),
    }).subscribe({
      next: (data) => {
        if (version !== this.loadVersion) return;
        this.applyData(
          tournament.days,
          tournament.fields,
          data.attendees,
          data.fragments,
          data.games,
          data.allocations,
          data.tournamentAllocations,
        );
      },
      error: () => {
        if (version !== this.loadVersion) return;
        this.error.set('Unable to load referee planning.');
        this.loading.set(false);
      },
    });
  }

  /** Resolves a public deep link using the public tournament document, independently of local storage. */
  private loadRouteTournament(tournamentId: string): void {
    if (this.requestedTournamentId === tournamentId) return;
    this.requestedTournamentId = tournamentId;
    ++this.loadVersion;
    this.loading.set(true);
    this.error.set('');
    this.tournamentService
      .byId(tournamentId)
      .pipe(take(1))
      .subscribe({
        next: (tournament) => {
          if (this.routeTournamentId() !== tournamentId) return;
          this.requestedTournamentId = '';
          if (tournament) this.tournamentService.setCurrentTournament(tournament);
          else {
            this.error.set('Tournament not found.');
            this.loading.set(false);
          }
        },
        error: () => {
          if (this.routeTournamentId() !== tournamentId) return;
          this.requestedTournamentId = '';
          this.error.set('Unable to load this tournament. Please retry.');
          this.loading.set(false);
        },
      });
  }

  /** Selects a planning fragment and rebuilds all three tab views. */
  selectScope(scopeId: string): void {
    this.selectedScopeId.set(scopeId);
    if (this.tab() === 'water') this.load();
    else this.rebuildViews();
  }

  /** Changes data sources only when moving between public water planning and existing views. */
  selectTab(tab: 'referees' | 'list' | 'coaches' | 'water' | null): void {
    if (!tab) return;
    const previous = this.tab();
    this.tab.set(tab);
    if (previous === 'water' || tab === 'water') this.load();
  }

  /** Loads public periods and the selected grid without protected Firestore collection reads. */
  private async loadWaterPlanning(tournamentId: string): Promise<void> {
    const version = ++this.loadVersion;
    this.loading.set(true);
    this.error.set('');
    try {
      let planning: WaterCarrierPlanning;
      try {
        planning = await this.waterService.load(tournamentId, this.selectedScopeId() || undefined);
      } catch (error: unknown) {
        if ((error as { status?: number }).status !== 403 || !this.selectedScopeId()) throw error;
        planning = await this.waterService.load(tournamentId);
      }
      if (version !== this.loadVersion) return;
      this.waterPlanning.set(planning);
      this.scopes.set(planning.periods.map((period) => ({ ...period, dayId: '', fields: [], timeslots: [] })));
      this.selectedScopeId.set(planning.selectedPeriodId ?? '');
    } catch {
      if (version !== this.loadVersion) return;
      this.waterPlanning.set(null);
      this.error.set('Unable to refresh planning. A completed assignment change remains saved. Please retry.');
    } finally {
      if (version === this.loadVersion) this.loading.set(false);
    }
  }

  /** Stores loaded data and initializes the visible planning scopes. */
  private applyData(
    days: Day[],
    fields: Field[],
    attendees: Attendee[],
    fragments: FragmentRefereeAllocation[],
    games: Game[],
    allocations: GameAttendeeAllocation[],
    tournamentAllocations: TournamentRefereeAllocation[],
  ): void {
    const tournamentAllocation = tournamentAllocations.find((allocation) => allocation.current === true);
    const selectedIds = new Set(tournamentAllocation?.fragmentRefereeAllocations.map((fragment) => fragment.id) ?? []);
    const visibleFragments = fragments.filter((fragment) => fragment.visible && selectedIds.has(fragment.id));
    this.source = {
      days,
      fields,
      attendees,
      fragments: visibleFragments,
      games,
      allocations,
      tournamentAllocation,
    };
    this.loadedAttendees.set(attendees);
    this.attendeeNames.set(Object.fromEntries(attendees.map((attendee) => [attendee.id, attendeeName(attendee)])));
    this.attendeeLevels.set(
      Object.fromEntries(attendees.map((attendee) => [attendee.id, this.attendeeLevel(attendee)])),
    );
    this.attendeeBadgeColors.set(
      Object.fromEntries(attendees.map((attendee) => [attendee.id, this.attendeeBadgeColor(attendee)])),
    );
    this.scopes.set(visibleFragments.map((fragment) => this.toScope(fragment, days, fields)));
    if (!this.scopes().some((scope) => scope.id === this.selectedScopeId()))
      this.selectedScopeId.set(this.scopes()[0]?.id ?? '');
    this.rebuildViews();
    this.loading.set(false);
  }

  private source: PlanningSource = {
    days: [],
    fields: [],
    attendees: [],
    fragments: [],
    games: [],
    allocations: [],
  };

  /** Converts one persisted fragment into the display scope used by the tabs. */
  private toScope(fragment: FragmentRefereeAllocation, days: Day[], fields: Field[]): PlanningScope {
    const day = days.find((item) => item.id === fragment.dayId)!;
    const part = fragment.partDayId ? day.parts.find((item) => item.id === fragment.partDayId) : undefined;
    const timeslots = part?.timeslots ?? day.parts.flatMap((item) => item.timeslots);
    const availableIds = part ? part.availableFieldIds : day.parts.flatMap((item) => item.availableFieldIds);
    const allAvailable = part?.allFieldsAvaillable || day.parts.some((item) => item.allFieldsAvaillable);
    return {
      id: fragment.id,
      label: part ? `Day ${day.id} - ${part.name || part.id}` : `Day ${day.id}`,
      dayId: day.id,
      partDayId: fragment.partDayId,
      timeslots,
      fields: (allAvailable ? fields : fields.filter((field) => availableIds.includes(field.id))).sort(
        (left, right) => left.orderView - right.orderView,
      ),
    };
  }

  /** Recomputes the games and available attendees for the selected scope. */
  private rebuildViews(): void {
    const scope = this.selectedScope();
    if (!scope) {
      this.games.set([]);
      this.availableReferees.set([]);
      this.availableCoaches.set([]);
      return;
    }
    const slotIds = new Set(scope.timeslots.map((slot) => slot.id));
    const fieldIds = new Set(scope.fields.map((field) => field.id));
    const assignments = this.source.allocations.filter(
      (allocation) => allocation.fragmentRefereeAllocationId === scope.id,
    );
    const games = this.source.games
      .filter((game) => game.dayId === scope.dayId && slotIds.has(game.timeslotId) && fieldIds.has(game.fieldId))
      .map((game) => this.toPlanningGame(game, scope, assignments));
    this.games.set(games);
    this.availableReferees.set(
      this.source.attendees.filter(
        (attendee) => attendee.isReferee && scope.timeslots.some((slot) => isAvailable(attendee, scope.dayId, slot.id)),
      ),
    );
    this.availableCoaches.set(
      this.source.attendees.filter(
        (attendee) =>
          attendee.isRefereeCoach && scope.timeslots.some((slot) => isAvailable(attendee, scope.dayId, slot.id)),
      ),
    );
  }

  /** Formats a referee level for the coaches planning tab. */
  private attendeeLevel(attendee: Attendee): string {
    const info = attendee.referee;
    const level = info
      ? `${info.badge}${info.category === 'O' ? '' : (info.category ?? '')}${info.upgrade ? '*' : ''}`
      : '';
    return level;
  }

  /** Returns the configured badge colors for a referee. */
  private attendeeBadgeColor(attendee: Attendee): {
    backgroundColor: string;
    color: string;
  } {
    const info = attendee.referee;
    const badgeColor = RefereeBadgeColors.find(
      (item) => item.badgeSystem === info?.badgeSystem && item.badge === info?.badge,
    );
    return {
      backgroundColor: badgeColor?.background ?? 'transparent',
      color: badgeColor?.font ?? 'inherit',
    };
  }

  /** Enriches one game with names and allocation rows for display. */
  private toPlanningGame(game: Game, scope: PlanningScope, assignments: GameAttendeeAllocation[]): PlanningGame {
    const tournament = this.tournament()!;
    const division = tournament.divisions.find((item) => item.id === game.divisionId);
    const field = scope.fields.find((item) => item.id === game.fieldId)!;
    const timeslot = scope.timeslots.find((item) => item.id === game.timeslotId)!;
    const gameAssignments = assignments
      .filter((allocation) => allocation.gameId === game.id)
      .sort((left, right) => left.attendeePosition - right.attendeePosition);
    return {
      game,
      field,
      timeslot,
      divisionName: division?.name ?? '',
      divisionBackgroundColor: division?.backgroundColor,
      divisionFontColor: division?.fontColor,
      homeTeamName: division?.teams.find((team) => team.id === game.homeTeamId)?.name ?? '',
      awayTeamName: division?.teams.find((team) => team.id === game.awayTeamId)?.name ?? '',
      referees: gameAssignments.filter((allocation) => isReferee(allocation.attendeeRole)),
      coaches: gameAssignments.filter((allocation) => isRefereeCoach(allocation.attendeeRole)),
    };
  }
}

/** Data loaded once and reused by all planning tabs. */
interface PlanningSource {
  days: Day[];
  fields: Field[];
  attendees: Attendee[];
  fragments: FragmentRefereeAllocation[];
  games: Game[];
  allocations: GameAttendeeAllocation[];
  tournamentAllocation?: TournamentRefereeAllocation;
}
