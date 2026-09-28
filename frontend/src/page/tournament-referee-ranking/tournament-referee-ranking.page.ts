import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { StepperModule } from 'primeng/stepper';
import { TabsModule } from 'primeng/tabs';
import { TooltipModule } from 'primeng/tooltip';
import { catchError, EMPTY, finalize, forkJoin, map, Observable, of, Subject, switchMap, take, tap } from 'rxjs';
import {
  Attendee,
  canEditCoachRanking,
  CoachRefereesRanking,
  createTournamentRefereeRanking,
  RefereeRankingStatus,
  refereeRankingTransitions,
  Tournament,
  TournamentRefereeRanking,
  isRankingReferee,
  RankingRefereeChanges,
  RankingCoachChanges,
  IndividualRankingChanges,
  RankingMaintenanceResponse,
} from '@tournament-manager/persistent-data-model';
import { RankingCoachesComponent } from '../../component/ranking-coaches/ranking-coaches.component';
import { RankingMeComponent } from '../../component/ranking-me/ranking-me.component';
import { RankingPanelComponent } from '../../component/ranking-panel/ranking-panel.component';
import { buildPanelTable } from '../../component/ranking-panel/panel-table';
import { PanelRankingExportService } from '../../service/panel-ranking-export.service';
import { RankingRefereesComponent } from '../../component/ranking-referees/ranking-referees.component';
import { AttendeeService } from '../../service/attendee.service';
import { RefereesRankingService } from '../../service/referees-ranking.service';
import { TournamentRefereeRankingService } from '../../service/tournament-referee-ranking.service';
import { TournamentService } from '../../service/tournament.service';
import { UserService } from '../../service/user.service';

/** Account-independent identity displayed in the coach selector and ranking heading. */
interface RankingCoachOption {
  id: string;
  label: string;
}

/** Page-owned ranking context shared by all four tabs without per-tab reads. */
@Component({
  selector: 'app-tournament-referee-ranking',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    StepperModule,
    TabsModule,
    TooltipModule,
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
  readonly coachSelection = new FormControl<string | null>(null);
  readonly newName = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/\S/)],
  });
  /** Connects native form submission to Angular's ngSubmit event and validation. */
  readonly createForm = new FormGroup({ name: this.newName });
  /** Ordered icon steps mapping persisted statuses to PrimeNG numeric values. */
  readonly statusSteps: { status: RefereeRankingStatus; label: string; icon: string }[] = [
    { status: 'CONFIGURE', label: 'Configure', icon: 'pi-cog' },
    { status: 'INDIVIDUAL_RANKING', label: 'Individual vote', icon: 'pi-user' },
    { status: 'PANEL_RANKING', label: 'Panel vote', icon: 'pi-users' },
    { status: 'CLOSED', label: 'Closed', icon: 'pi-lock' },
  ];
  /** Reflects the saved status, including when a transition fails. */
  readonly statusStep = computed(
    () => this.statusSteps.findIndex((step) => step.status === this.selectedRanking()?.status) + 1,
  );
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly userService = inject(UserService);
  private readonly tournamentService = inject(TournamentService);
  private readonly attendeeService = inject(AttendeeService);
  private readonly rankingService = inject(TournamentRefereeRankingService);
  private readonly panelExport = inject(PanelRankingExportService);
  private readonly coachRankingService = inject(RefereesRankingService);
  private readonly selectedRankingRequests = new Subject<string | null>();
  private readonly tabs = ['referees', 'coaches', 'me', 'panel'];
  readonly activeTab = signal('referees');
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
  readonly pendingDeletion = signal<string | null>(null);
  readonly pendingRemoval = signal<string[]>([]);
  readonly pendingCoachChanges = signal<RankingCoachChanges | null>(null);
  private readonly requestedCoach = signal<{ rankingId: string | null; coachId: string | null } | null>(null);

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
  readonly coachOptions = computed(() => {
    const ranking = this.selectedRanking();
    return this.coaches()
      .filter(
        (coach) =>
          coach.isRefereeCoach &&
          coach.tournamentId === ranking?.tournamentId &&
          (ranking.selectedCoachAttendeeIds.includes(coach.id) || coach.id === this.currentCoach()?.id),
      )
      .map((coach) => ({ id: coach.id, label: this.coachLabel(coach) }))
      .sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
  });
  readonly selectedCoach = computed<RankingCoachOption | null>(() => {
    const options = this.coachOptions();
    const requested = this.requestedCoach();
    const chosen =
      requested?.rankingId === this.selectedId() ? options.find((coach) => coach.id === requested?.coachId) : undefined;
    return chosen ?? options.find((coach) => coach.id === this.currentCoach()?.id) ?? options[0] ?? null;
  });
  readonly selectedCoachRanking = computed(
    () => this.coachRankings().find((item) => item.coachAttendeeId === this.selectedCoach()?.id) ?? null,
  );
  readonly canEditSelectedCoach = computed(() => {
    const ranking = this.selectedRanking();
    return (
      this.allowed() &&
      !!ranking &&
      canEditCoachRanking(ranking, this.currentCoach()?.id ?? '', this.selectedCoach()?.id ?? '')
    );
  });
  readonly coachSelectionDisabled = computed(() => this.saving() || this.loadingCoaches() || !!this.coachError());

  /** Explains the first unmet Compute prerequisite; empty means the action is available. */
  readonly computeDisabledReason = computed(() => {
    const ranking = this.selectedRanking();
    if (!this.allowed() || !ranking) return 'Select a ranking first.';
    if (this.saving()) return 'Wait for the current save to finish.';
    if (this.loadingCoaches()) return 'Wait for coach rankings to load.';
    if (this.coachError()) return 'Click Retry to load coach rankings.';
    if (!ranking.selectedRefereeAttendeeIds.length) return 'Select referees in the Referees tab first.';
    if (ranking.status === 'CLOSED') return 'This ranking is closed and cannot be computed again.';
    if (ranking.status !== 'PANEL_RANKING') return 'Select the Panel vote step to compute.';
    // Only selected, locked votes containing eligible referees can help reach the majority.
    const ready = this.coachRankings().filter(
      (vote) =>
        vote.locked &&
        vote.tournamentId === ranking.tournamentId &&
        vote.tournamentRefereeRankingId === ranking.id &&
        ranking.selectedCoachAttendeeIds.includes(vote.coachAttendeeId) &&
        vote.rankedRefereeAttendeeIds.some((id) => ranking.selectedRefereeAttendeeIds.includes(id)),
    ).length;
    return ready < ranking.voteMajority
      ? `Fill and lock at least ${ranking.voteMajority} selected coach rankings in Coach Ranking (${ready}/${ranking.voteMajority} ready). Check panel selection and vote majority in Coaches.`
      : '';
  });

  /** Installs page-level loaders; switching context cancels obsolete reads. */
  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const tab = params.get('tab');
      this.activeTab.set(tab && this.tabs.includes(tab) ? tab : 'referees');
    });
    this.watchRankingSelection();
    this.rankingSelection.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => this.selectRanking(id));
    this.coachSelection.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => this.selectCoach(id));
    effect(() => {
      const coachId = this.selectedCoach()?.id ?? null;
      const rankingId = this.selectedId();
      const requested = this.requestedCoach();
      // Persist fallbacks locally so a removed target is not restored when membership changes again.
      if (requested?.rankingId !== rankingId || requested?.coachId !== coachId)
        this.requestedCoach.set({ rankingId, coachId });
      this.coachSelection.setValue(coachId, { emitEvent: false });
      if (this.coachSelectionDisabled()) this.coachSelection.disable({ emitEvent: false });
      else this.coachSelection.enable({ emitEvent: false });
    });
    this.route.paramMap
      .pipe(
        switchMap((params) => this.loadTournament(params.get('tournamentId') ?? '')),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  /** Persists the selected tab in the URL while preserving other query parameters. */
  tabSelected(tab: string | number | undefined): void {
    if (typeof tab !== 'string' || !this.tabs.includes(tab) || tab === this.activeTab()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      preserveFragment: true,
    });
  }

  /** Computes for any tournament coach, retaining the saved result on errors. */
  computePanel(): void {
    const ranking = this.selectedRanking();
    const coach = this.currentCoach();
    if (this.computeDisabledReason() || !ranking || !coach) return;
    this.persistConfiguration(
      this.rankingService.compute(ranking, this.coachRankings(), this.attendeesById(), coach.id),
      'Panel computation',
    );
  }

  /** Downloads precisely the visible panel and practice columns without modifying freshness. */
  exportPanel(): void {
    const ranking = this.selectedRanking();
    if (!this.panelActionAllowed() || !ranking) return;
    this.error.set('');
    try {
      this.panelExport.download(
        this.tournament()?.name ?? '',
        ranking,
        buildPanelTable(ranking, this.coachRankings(), this.attendeesById()),
      );
    } catch (error: unknown) {
      console.error('[Referee ranking] Export failed', error);
      this.error.set('The panel could not be exported. Please try again.');
    }
  }

  /** Deletes only the explicitly confirmed parent, including CLOSED and practice data. */
  confirmDeletion(): void {
    const ranking = this.selectedRanking();
    const coach = this.currentCoach();
    if (!this.allowed() || !ranking || !coach || this.saving() || this.pendingDeletion() !== ranking.id) return;
    this.saving.set(true);
    this.error.set('');
    this.rankingService
      .deleteRanking({
        tournamentId: ranking.tournamentId,
        tournamentRefereeRankingId: ranking.id,
        actorCoachAttendeeId: coach.id,
      })
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.rankings.update((items) => items.filter((item) => item.id !== ranking.id));
          if (this.selectedId() === ranking.id) this.selectRanking(this.rankings()[0]?.id ?? null);
        },
        error: (error: unknown) => {
          console.error('[Referee ranking] Deletion failed', error);
          this.error.set('Deletion could not be completed. Please retry to finish removing the ranking.');
        },
      });
  }

  /** Changes the viewed target without writes or extra reads, retaining selection while a save is pending. */
  selectCoach(coachId: string | null): void {
    if (!this.coachSelectionDisabled() && this.coachOptions().some((coach) => coach.id === coachId))
      this.requestedCoach.set({ rankingId: this.selectedId(), coachId });
    this.coachSelection.setValue(this.selectedCoach()?.id ?? null, { emitEvent: false });
  }

  /** Saves the selected target as the authenticated actor, accepting shared data only after commit. */
  saveIndividual(changes: IndividualRankingChanges): void {
    const ranking = this.selectedRanking();
    const coach = this.currentCoach();
    const target = this.selectedCoach();
    if (
      !this.allowed() ||
      !ranking ||
      !coach ||
      !target ||
      !this.canEditSelectedCoach() ||
      this.saving() ||
      this.loadingCoaches() ||
      this.coachError() ||
      !ranking.selectedRefereeAttendeeIds.length ||
      !['INDIVIDUAL_RANKING', 'PANEL_RANKING'].includes(ranking.status)
    )
      return;
    this.saving.set(true);
    this.error.set('');
    this.coachRankingService
      .saveIndividual(ranking, this.selectedCoachRanking(), coach.id, target.id, changes)
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (saved) => {
          this.rankings.update((items) =>
            items.map((item) =>
              item.id === ranking.id && saved.panelResultState !== ranking.panelResultState
                ? {
                    ...item,
                    panelResultState: saved.panelResultState,
                    updatedByCoachAttendeeId: coach.id,
                    updatedCoachAttendeeId: target.id,
                    lastChange: saved.individual.lastChange,
                  }
                : item,
            ),
          );
          if (this.selectedId() === ranking.id)
            this.coachRankings.update((items) => [
              ...items.filter((item) => item.id !== saved.individual.id),
              saved.individual,
            ]);
        },
        error: (error: unknown) => {
          console.error('[Referee ranking] Individual save failed', error);
          this.error.set(
            'The coach ranking could not be saved. The previous order and lock are unchanged. Please try again.',
          );
        },
      });
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
    if (!this.transitions().includes(status)) return;
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

  /** Applies page access, grouped-load and missing-referee guards to Panel actions. */
  private panelActionAllowed(): boolean {
    return (
      this.allowed() &&
      !this.saving() &&
      !this.loadingCoaches() &&
      !this.coachError() &&
      !!this.selectedRanking()?.selectedRefereeAttendeeIds.length
    );
  }

  /** Uses the coach short name, then full name or attendee ID when identity details are incomplete. */
  private coachLabel(coach: Attendee): string {
    return (
      coach.person?.shortName?.trim() ||
      `${coach.person?.firstName ?? ''} ${coach.person?.lastName?.toUpperCase() ?? ''}`.trim() ||
      coach.id
    );
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
    const coach = context.coaches.find(
      (item) => item.isRefereeCoach && item.person?.email?.trim().toLowerCase() === user?.email?.trim().toLowerCase(),
    );
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
    this.pendingDeletion.set(null);
    this.pendingRemoval.set([]);
    this.pendingCoachChanges.set(null);
    this.selectedId.set(id);
    this.requestedCoach.set(null);
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
