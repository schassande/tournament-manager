import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TabsModule } from 'primeng/tabs';
import { catchError, EMPTY, finalize, forkJoin, map, Observable, of, Subject, switchMap, take, tap } from 'rxjs';
import {
  Attendee,
  CoachRefereesRanking,
  createTournamentRefereeRanking,
  RefereeRankingStatus,
  refereeRankingTransitions,
  Tournament,
  TournamentRefereeRanking,
  isRankingReferee,
  RankingRefereeChanges,
  RankingCoachChanges,
  RankingMaintenanceResponse,
} from '@tournament-manager/persistent-data-model';
import { RankingCoachesComponent } from '../../component/ranking-coaches/ranking-coaches.component';
import { RankingMeComponent } from '../../component/ranking-me.component';
import { RankingPanelComponent } from '../../component/ranking-panel.component';
import { RankingRefereesComponent } from '../../component/ranking-referees/ranking-referees.component';
import { AttendeeService } from '../../service/attendee.service';
import { RefereesRankingService } from '../../service/referees-ranking.service';
import { TournamentRefereeRankingService } from '../../service/tournament-referee-ranking.service';
import { TournamentService } from '../../service/tournament.service';
import { UserService } from '../../service/user.service';

/** Page-owned ranking context shared by all four tabs without per-tab reads. */
@Component({
  selector: 'app-tournament-referee-ranking',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    TabsModule,
    RankingRefereesComponent,
    RankingCoachesComponent,
    RankingMeComponent,
    RankingPanelComponent,
  ],
  templateUrl: './tournament-referee-ranking.page.html',
  styleUrl: './tournament-referee-ranking.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TournamentRefereeRankingComponent {
  readonly rankingSelection = new FormControl<string | null>(null);
  readonly newName = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/\S/)],
  });
  /** Connects native form submission to Angular's ngSubmit event and validation. */
  readonly createForm = new FormGroup({ name: this.newName });
  readonly statusLabels: Record<RefereeRankingStatus, string> = {
    CONFIGURE: 'Configure',
    INDIVIDUAL_RANKING: 'Individual ranking',
    PANEL_RANKING: 'Panel ranking',
    CLOSED: 'Closed',
  };
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly userService = inject(UserService);
  private readonly tournamentService = inject(TournamentService);
  private readonly attendeeService = inject(AttendeeService);
  private readonly rankingService = inject(TournamentRefereeRankingService);
  private readonly coachRankingService = inject(RefereesRankingService);
  private readonly selectedRankingRequests = new Subject<string | null>();
  readonly tournament = signal<Tournament | null>(null);
  readonly currentCoach = signal<Attendee | null>(null);
  readonly referees = signal<Attendee[]>([]);
  readonly coaches = signal<Attendee[]>([]);
  readonly rankings = signal<TournamentRefereeRanking[]>([]);
  readonly coachRankings = signal<CoachRefereesRanking[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly loading = signal(true);
  readonly loadingCoaches = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly coachError = signal('');
  readonly allowed = signal(false);
  readonly createDialog = signal(false);
  readonly pendingRemoval = signal<string[]>([]);
  readonly pendingCoachChanges = signal<RankingCoachChanges | null>(null);

  readonly attendeesById = computed(
    () => new Map([...this.referees(), ...this.coaches()].map((attendee) => [attendee.id, attendee])),
  );
  readonly selectedRanking = computed(
    () => this.rankings().find((ranking) => ranking.id === this.selectedId()) ?? null,
  );
  readonly transitions = computed(() => {
    const ranking = this.selectedRanking();
    return ranking ? refereeRankingTransitions(ranking) : [];
  });

  /** Installs page-level loaders; switching context cancels obsolete reads. */
  constructor() {
    this.watchRankingSelection();
    this.rankingSelection.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => this.selectRanking(id));
    this.route.paramMap
      .pipe(
        switchMap((params) => this.loadTournament(params.get('tournamentId') ?? '')),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  /** Validates panel edits against the shared coach cache and confirms removals after CONFIGURE. */
  saveCoaches(changes: RankingCoachChanges): void {
    const ranking = this.selectedRanking();
    const coach = this.currentCoach();
    if (
      !this.allowed() ||
      !ranking ||
      !coach ||
      this.saving() ||
      this.loadingCoaches() ||
      this.coachError() ||
      ranking.status === 'CLOSED' ||
      this.pendingCoachChanges()
    )
      return;
    const ids = changes.selectedCoachAttendeeIds;
    if (
      ids?.some(
        (id) =>
          !ranking.selectedCoachAttendeeIds.includes(id) &&
          !this.coaches().some(
            (item) => item.id === id && item.isRefereeCoach && item.tournamentId === ranking.tournamentId,
          ),
      )
    )
      return;
    if (ids && ranking.status !== 'CONFIGURE' && ranking.selectedCoachAttendeeIds.some((id) => !ids.includes(id))) {
      this.pendingCoachChanges.set(changes);
      return;
    }
    this.persistConfiguration(this.rankingService.saveCoaches(ranking, changes, coach.id), 'Coach');
  }

  /** Confirms only panel membership changes; the coach's entire individual record is retained. */
  confirmCoachRemoval(): void {
    const changes = this.pendingCoachChanges();
    const ranking = this.selectedRanking();
    const coach = this.currentCoach();
    if (
      !changes ||
      !ranking ||
      !coach ||
      !this.allowed() ||
      this.saving() ||
      this.loadingCoaches() ||
      this.coachError() ||
      ranking.status === 'CLOSED'
    )
      return;
    this.pendingCoachChanges.set(null);
    this.persistConfiguration(this.rankingService.saveCoaches(ranking, changes, coach.id), 'Coach');
  }

  /** Saves one valid Referees-tab edit and updates the cache only on success. */
  saveReferees(changes: RankingRefereeChanges): void {
    const ranking = this.selectedRanking();
    const coach = this.currentCoach();
    if (
      !this.allowed() ||
      !ranking ||
      !coach ||
      this.saving() ||
      this.loadingCoaches() ||
      this.coachError() ||
      ranking.status === 'CLOSED'
    )
      return;
    this.persistConfiguration(this.rankingService.saveReferees(ranking, changes, coach.id));
  }

  /** Requires confirmation only once individual ranking has started. */
  requestRemoval(ids: string[]): void {
    if (
      this.saving() ||
      this.loadingCoaches() ||
      this.coachError() ||
      !this.selectedRanking() ||
      this.selectedRanking()?.status === 'CLOSED'
    )
      return;
    this.pendingRemoval.set(ids);
    if (this.selectedRanking()?.status === 'CONFIGURE') this.confirmRemoval();
  }

  /** Applies the backend's committed parent and individual records together. */
  confirmRemoval(): void {
    const ranking = this.selectedRanking();
    const coach = this.currentCoach();
    if (!ranking || !coach || !this.allowed() || !this.pendingRemoval().length || this.saving()) return;
    const refereeAttendeeIds = this.pendingRemoval();
    this.pendingRemoval.set([]);
    this.persistConfiguration(
      this.rankingService
        .removeReferees({
          tournamentId: ranking.tournamentId,
          tournamentRefereeRankingId: ranking.id,
          actorCoachAttendeeId: coach.id,
          refereeAttendeeIds,
        })
        .pipe(
          tap((response) => this.acceptMaintenance(response)),
          map((response) => response.ranking),
        ),
    );
  }

  /** Opens a fresh name form without changing the currently selected ranking. */
  openCreate(): void {
    this.error.set('');
    this.newName.reset();
    this.createDialog.set(true);
  }

  /** Saves the initial configuration and selects it only after successful persistence. */
  createRanking(): void {
    const tournament = this.tournament();
    const coach = this.currentCoach();
    if (!this.allowed() || !tournament || !coach || this.newName.invalid || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    const ranking = createTournamentRefereeRanking(tournament.id, coach.id, this.newName.value);
    this.rankingService
      .createRanking(ranking)
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (saved) => this.acceptCreatedRanking(saved),
        error: () => this.error.set('The ranking could not be created. Please try again.'),
      });
  }

  /** Saves an allowed phase transition without changing the local status on failure. */
  changeStatus(status: RefereeRankingStatus): void {
    const ranking = this.selectedRanking();
    const coach = this.currentCoach();
    if (!this.allowed() || !ranking || !coach || this.saving() || this.loadingCoaches() || this.coachError()) return;
    this.saving.set(true);
    this.error.set('');
    this.rankingService
      .changeStatus(ranking, status, coach.id)
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (saved) => this.rankings.update((items) => items.map((item) => (item.id === saved.id ? saved : item))),
        error: () => this.error.set('The status could not be saved. Please try again.'),
      });
  }

  /** Retries the current grouped individual load without refetching attendees. */
  retryCoachRankings(): void {
    this.selectedRankingRequests.next(this.selectedId());
  }

  /** Runs a save with rollback-by-retention and a visible retryable error. */
  private persistConfiguration(operation: Observable<TournamentRefereeRanking>, subject = 'Referee'): void {
    this.saving.set(true);
    this.error.set('');
    operation
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (saved) => this.rankings.update((items) => items.map((item) => (item.id === saved.id ? saved : item))),
        error: (error: unknown) => {
          console.error(`[Referee ranking] ${subject} configuration save failed`, error);
          this.error.set(
            `${subject} changes could not be saved. The previous configuration is unchanged. Please try again.`,
          );
        },
      });
  }

  /** Replaces page-owned records only for the still-selected parent. */
  private acceptMaintenance(response: RankingMaintenanceResponse): void {
    this.rankings.update((items) => items.map((item) => (item.id === response.ranking.id ? response.ranking : item)));
    if (this.selectedId() === response.ranking.id) this.coachRankings.set(response.coachRankings);
  }

  /** Detects dangling, unselected or ineligible IDs after the grouped read, then delegates repair. */
  private repairIfNeeded(items: CoachRefereesRanking[]): Observable<CoachRefereesRanking[]> {
    const ranking = this.selectedRanking();
    const coach = this.currentCoach();
    if (!ranking || !coach || ranking.status === 'CLOSED') return of(items);
    const eligible = new Set(this.referees().map((item) => item.id));
    const selected = new Set(ranking.selectedRefereeAttendeeIds);
    const invalid =
      ranking.selectedRefereeAttendeeIds.some((id) => !eligible.has(id)) ||
      [
        ...ranking.panelRefereesRanking.rankedRefereeAttendeeIds,
        ...items.flatMap((item) => item.rankedRefereeAttendeeIds),
      ].some((id) => !eligible.has(id) || !selected.has(id));
    if (!invalid) return of(items);
    return this.rankingService
      .repairRanking({
        tournamentId: ranking.tournamentId,
        tournamentRefereeRankingId: ranking.id,
        actorCoachAttendeeId: coach.id,
      })
      .pipe(
        tap((response) => this.acceptMaintenance(response)),
        map((response) => response.coachRankings),
      );
  }

  /** Loads one tournament and the two attendee sets before granting page access. */
  private loadTournament(tournamentId: string): Observable<unknown> {
    this.resetContext();
    return forkJoin({
      tournament: this.tournamentService.byId(tournamentId).pipe(
        take(1),
        map((value) => value ?? null),
      ),
      referees: this.attendeeService.findTournamentReferees(tournamentId),
      coaches: this.attendeeService.findTournamentRefereeCoaches(tournamentId),
    }).pipe(
      switchMap((context) => this.acceptContext(context)),
      catchError(() => {
        this.error.set('Rankings could not be loaded. Reload the page to try again.');
        return EMPTY;
      }),
      finalize(() => this.loading.set(false)),
    );
  }

  /** Checks the module and actor from the loaded coach cache before reading rankings. */
  private acceptContext(context: {
    tournament: Tournament | null;
    referees: Attendee[];
    coaches: Attendee[];
  }): Observable<unknown> {
    const user = this.userService.currentUser$();
    const coach = context.coaches.find((item) => item.isRefereeCoach && item.person?.personId === user?.id);
    if (!user || !coach || !context.tournament?.enablesModules?.includes('RANKING')) {
      this.error.set('Ranking is available to this tournament’s referee coaches when the Ranking module is enabled.');
      return EMPTY;
    }
    this.tournament.set(context.tournament);
    this.tournamentService.setCurrentTournament(context.tournament);
    this.currentCoach.set(coach);
    this.coaches.set(context.coaches);
    this.referees.set(context.referees.filter(isRankingReferee));
    this.allowed.set(true);
    return this.rankingService.findByTournament(context.tournament.id).pipe(
      tap((items) => {
        this.rankings.set(items);
        this.selectRanking(items[0]?.id ?? null);
      }),
    );
  }

  /** Clears data from the previous tournament before starting another route load. */
  private resetContext(): void {
    this.loading.set(true);
    this.allowed.set(false);
    this.error.set('');
    this.createDialog.set(false);
    this.tournament.set(null);
    this.currentCoach.set(null);
    this.referees.set([]);
    this.coaches.set([]);
    this.rankings.set([]);
    this.selectRanking(null);
  }

  /** Replaces the selection and immediately removes the previous coach data. */
  private selectRanking(id: string | null): void {
    this.pendingRemoval.set([]);
    this.pendingCoachChanges.set(null);
    this.selectedId.set(id);
    this.rankingSelection.setValue(id, { emitEvent: false });
    this.selectedRankingRequests.next(id);
  }

  /** Keeps all individual records in a single cancellable query per selection. */
  private watchRankingSelection(): void {
    this.selectedRankingRequests
      .pipe(
        switchMap((id) => {
          this.coachRankings.set([]);
          this.coachError.set('');
          this.loadingCoaches.set(!!id);
          if (!id) return EMPTY;
          return this.coachRankingService.findByRanking(id).pipe(
            switchMap((items) => this.repairIfNeeded(items)),
            tap((items) => this.coachRankings.set(items)),
            catchError(() => {
              this.coachError.set('Coach rankings could not be loaded.');
              return EMPTY;
            }),
            finalize(() => this.loadingCoaches.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  /** Adds the persisted creation to the page cache and closes its dialog. */
  private acceptCreatedRanking(ranking: TournamentRefereeRanking): void {
    if (ranking.tournamentId !== this.tournament()?.id) return;
    this.rankings.update((items) => [...items, ranking]);
    this.createDialog.set(false);
    this.selectRanking(ranking.id);
  }
}
