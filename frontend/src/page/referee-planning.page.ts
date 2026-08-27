import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
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
} from '@tournament-manager/persistent-data-model';
import { CoachesPlanningComponent } from '../component/coaches-planning.component';
import { RefereesListComponent } from '../component/referees-list.component';
import { RefereesPlanningComponent } from '../component/referees-planning.component';
import { AbstractTournamentPage } from '../component/tournament-abstract.page';
import { AttendeeService } from '../service/attendee.service';
import { FragmentRefereeAllocationService } from '../service/fragment-referee-allocation.service';
import { GameAttendeeAllocationService } from '../service/game-attendee-allocation.service';
import { GameService } from '../service/game.service';
import {
  attendeeName,
  isAvailable,
  PlanningGame,
  PlanningScope,
} from '../service/referee-planning-model';
import { TournamentRefereeAllocationService } from '../service/tournament-referee-allocation.service';
import { UserService } from '../service/user.service';

/** Displays read-only referee and coach planning for visible allocation fragments. */
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <div class="planning-status">Loading planning…</div>
    }
    @if (error(); as message) {
      <div class="planning-status error" role="alert">
        {{ message }} <p-button label="Retry" (click)="load()" />
      </div>
    }
    @if (!loading() && !error() && scopes().length === 0) {
      <div class="planning-status">Referees have not yet been allocated.</div>
    }
    @if (!loading() && !error() && scopes().length > 0) {
      @if (selectedScope(); as scope) {
        <div class="planning-page">
          <div class="planning-toolbar">
            <div class="scope-form">
              <p-select
                inputId="planning-scope"
                [options]="scopes()"
                optionLabel="label"
                optionValue="id"
                [ngModel]="scope.id"
                (ngModelChange)="selectScope($event)"
                ariaLabel="Planning scope"
              />
            </div>
            <nav class="planning-tabs" aria-label="Planning views">
              <p-selectbutton
                [options]="tabOptions()"
                optionLabel="label"
                optionValue="value"
                [ngModel]="tab()"
                (ngModelChange)="tab.set($event)"
              />
            </nav>
          </div>
          @if (tab() === 'referees') {
            <app-referees-planning
              [fields]="scope.fields"
              [timeslots]="scope.timeslots"
              [games]="games()"
              [attendeeNames]="attendeeNames()"
              [scopeLabel]="scope.label"
            />
          }
          @if (tab() === 'list') {
            <app-referees-list
              [referees]="availableReferees()"
              [timeslots]="scope.timeslots"
              [games]="games()"
              [scopeLabel]="scope.label"
              [allowPlayerReferees]="tournament()?.allowPlayerReferees ?? false"
            />
          }
          @if (tab() === 'coaches') {
            <app-coaches-planning
              [coaches]="availableCoaches()"
              [timeslots]="scope.timeslots"
              [games]="games()"
              [attendeeNames]="attendeeNames()"
              [attendeeLevels]="attendeeLevels()"
              [attendeeBadgeColors]="attendeeBadgeColors()"
              [scopeLabel]="scope.label"
            />
          }
        </div>
      }
    }
  `,
  styles: [
    `
      .planning-page {
        box-sizing: border-box;
        height: calc(100vh - 76px);
        max-height: calc(100vh - 76px);
        overflow: hidden;
      }
      .planning-status {
        margin: 2rem auto;
        max-width: 42rem;
        text-align: center;
      }
      .planning-status.error {
        color: #a61b1b;
      }
      .planning-toolbar {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
        margin-bottom: 0.25rem;
      }
      .scope-form {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .scope-form select {
        min-width: 18rem;
        padding: 0.4rem;
      }
      .planning-tabs {
        display: flex;
      }
    `,
  ],
})
export class RefereePlanningComponent extends AbstractTournamentPage {
  private readonly attendeeService = inject(AttendeeService);
  private readonly fragmentService = inject(FragmentRefereeAllocationService);
  private readonly gameService = inject(GameService);
  private readonly allocationService = inject(GameAttendeeAllocationService);
  private readonly tournamentAllocationService = inject(
    TournamentRefereeAllocationService,
  );
  private readonly userService = inject(UserService);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly tab = signal<'referees' | 'list' | 'coaches'>('referees');
  readonly tabOptions = computed(() => [
    { label: 'Referees Planning', value: 'referees' as const },
    { label: 'Referees List', value: 'list' as const },
    ...(this.canAccessCoaches() ? [{ label: 'Coaches', value: 'coaches' as const }] : []),
  ]);
  readonly scopes = signal<PlanningScope[]>([]);
  readonly selectedScopeId = signal('');
  readonly availableReferees = signal<Attendee[]>([]);
  readonly availableCoaches = signal<Attendee[]>([]);
  readonly games = signal<PlanningGame[]>([]);
  readonly attendeeNames = signal<Record<string, string>>({});
  readonly attendeeLevels = signal<Record<string, string>>({});
  readonly attendeeBadgeColors = signal<
    Record<string, { backgroundColor: string; color: string }>
  >({});
  readonly selectedScope = computed(() =>
    this.scopes().find((scope) => scope.id === this.selectedScopeId()),
  );
  readonly canAccessCoaches = computed(() => {
    const user = this.userService.currentUser$();
    const tournament = this.tournament();
    return !!user && !!tournament && this.source.attendees.some(
      (attendee) =>
        attendee.tournamentId === tournament.id &&
        attendee.person?.personId === user.id &&
        attendee.isRefereeCoach,
    );
  });

  constructor() {
    super();
    effect(() => {
      if (this.tournament()) untracked(() => this.load());
    });
    effect(() => {
      if (!this.canAccessCoaches() && this.tab() === 'coaches') {
        this.tab.set('referees');
      }
    });
  }

  /** Loads the current tournament's visible planning data. */
  load(): void {
    const tournament = this.tournament();
    if (!tournament || this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      attendees: this.attendeeService
        .findByTournament(tournament.id)
        .pipe(take(1)),
      fragments: this.fragmentService
        .byTournament(tournament.id)
        .pipe(take(1)),
      games: this.gameService.byTournament(tournament.id).pipe(take(1)),
      allocations: this.allocationService
        .byTournament(tournament.id)
        .pipe(take(1)),
      tournamentAllocations: this.tournamentAllocationService.byTournament(
        tournament.id,
      ).pipe(take(1)),
    }).subscribe({
      next: (data) =>
        this.applyData(
          tournament.days,
          tournament.fields,
          data.attendees,
          data.fragments,
          data.games,
          data.allocations,
          data.tournamentAllocations,
        ),
      error: () => {
        this.error.set('Unable to load referee planning.');
        this.loading.set(false);
      },
    });
  }

  /** Selects a planning fragment and rebuilds all three tab views. */
  selectScope(scopeId: string): void {
    this.selectedScopeId.set(scopeId);
    this.rebuildViews();
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
    const tournamentAllocation =
      tournamentAllocations.find((allocation) => allocation.current) ??
      tournamentAllocations[0];
    const selectedIds = new Set(
      tournamentAllocation?.fragmentRefereeAllocations.map(
        (fragment) => fragment.id,
      ) ?? [],
    );
    const visibleFragments = fragments.filter(
      (fragment) => fragment.visible && selectedIds.has(fragment.id),
    );
    this.source = {
      days,
      fields,
      attendees,
      fragments: visibleFragments,
      games,
      allocations,
      tournamentAllocation,
    };
    this.attendeeNames.set(
      Object.fromEntries(
        attendees.map((attendee) => [attendee.id, attendeeName(attendee)]),
      ),
    );
    this.attendeeLevels.set(
      Object.fromEntries(
        attendees.map((attendee) => [
          attendee.id,
          this.attendeeLevel(attendee),
        ]),
      ),
    );
    this.attendeeBadgeColors.set(
      Object.fromEntries(
        attendees.map((attendee) => [attendee.id, this.attendeeBadgeColor(attendee)]),
      ),
    );
    this.scopes.set(
      visibleFragments.map((fragment) => this.toScope(fragment, days, fields)),
    );
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
  private toScope(
    fragment: FragmentRefereeAllocation,
    days: Day[],
    fields: Field[],
  ): PlanningScope {
    const day = days.find((item) => item.id === fragment.dayId)!;
    const part = fragment.partDayId
      ? day.parts.find((item) => item.id === fragment.partDayId)
      : undefined;
    const timeslots =
      part?.timeslots ?? day.parts.flatMap((item) => item.timeslots);
    const availableIds = part
      ? part.availableFieldIds
      : day.parts.flatMap((item) => item.availableFieldIds);
    const allAvailable =
      part?.allFieldsAvaillable ||
      day.parts.some((item) => item.allFieldsAvaillable);
    return {
      id: fragment.id,
      label: part ? `Day ${day.id} - ${part.name || part.id}` : `Day ${day.id}`,
      dayId: day.id,
      partDayId: fragment.partDayId,
      timeslots,
      fields: (allAvailable
        ? fields
        : fields.filter((field) => availableIds.includes(field.id))
      ).sort((left, right) => left.orderView - right.orderView),
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
      .filter(
        (game) =>
          game.dayId === scope.dayId &&
          slotIds.has(game.timeslotId) &&
          fieldIds.has(game.fieldId),
      )
      .map((game) => this.toPlanningGame(game, scope, assignments));
    this.games.set(games);
    this.availableReferees.set(
      this.source.attendees.filter(
        (attendee) =>
          attendee.isReferee &&
          scope.timeslots.some((slot) =>
            isAvailable(attendee, scope.dayId, slot.id),
          ),
      ),
    );
    this.availableCoaches.set(
      this.source.attendees.filter(
        (attendee) =>
          attendee.isRefereeCoach &&
          scope.timeslots.some((slot) =>
            isAvailable(attendee, scope.dayId, slot.id),
          ),
      ),
    );
  }

  /** Formats a referee level for the coaches planning tab. */
  private attendeeLevel(attendee: Attendee): string {
    const info = attendee.referee;
    const level = info
      ? `${info.badge}${info.category === 'O' ? '' : info.category ?? ''}${info.upgrade ? '*' : ''}`
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
  private toPlanningGame(
    game: Game,
    scope: PlanningScope,
    assignments: GameAttendeeAllocation[],
  ): PlanningGame {
    const tournament = this.tournament()!;
    const division = tournament.divisions.find(
      (item) => item.id === game.divisionId,
    );
    const field = scope.fields.find((item) => item.id === game.fieldId)!;
    const timeslot = scope.timeslots.find(
      (item) => item.id === game.timeslotId,
    )!;
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
      homeTeamName:
        division?.teams.find((team) => team.id === game.homeTeamId)?.name ?? '',
      awayTeamName:
        division?.teams.find((team) => team.id === game.awayTeamId)?.name ?? '',
      referees: gameAssignments.filter((allocation) =>
        isReferee(allocation.attendeeRole),
      ),
      coaches: gameAssignments.filter((allocation) =>
        isRefereeCoach(allocation.attendeeRole),
      ),
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
