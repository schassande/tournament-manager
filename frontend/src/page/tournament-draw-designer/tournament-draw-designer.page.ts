import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Attendee,
  Division,
  DivisionDraw,
  DrawType,
  GroupNames,
  Group,
  PointCalculation,
  PDrawType,
  Step,
  OuputTeamRankingStrategy,
  SpreadTeamsAlgo,
  TeamReference,
  SpecificDataCup,
} from '@tournament-manager/persistent-data-model';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { forkJoin, of, switchMap, take } from 'rxjs';
import { AttendeeService } from '../../service/attendee.service';
import { DivisionDrawService } from '../../service/draw/division-draw.service';
import { GameService } from '../../service/game.service';
import { TournamentService } from '../../service/tournament.service';
import { PDrawTypeService } from '../../service/draw/pdrawtype.service';

const SPREAD_TEAMS_ALGOS: { label: string; value: SpreadTeamsAlgo }[] = [
  { label: 'Random', value: 'Random' },
  { label: 'Best teams together', value: 'Best teams together' },
  { label: 'Spread best teams', value: 'Spread best teams' },
  { label: 'Manual', value: ' Manual' },
];

const OUTPUT_TEAM_RANKING_STRATEGIES: { label: string; value: OuputTeamRankingStrategy }[] = [
  { label: 'Group order', value: 'GROUP_ORDER' },
  { label: 'Best teams together', value: 'BEST_TOGETHER' },
];

const SUCCESS_MESSAGE_DURATION_MS = 3000;

/** Edits persisted competition structure for one tournament division. */
@Component({
  selector: 'app-tournament-draw-designer',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    ConfirmDialogModule,
    InputNumberModule,
    InputTextModule,
    MessageModule,
    SelectModule,
    TooltipModule,
  ],
  templateUrl: './tournament-draw-designer.page.html',
  styleUrl: './tournament-draw-designer.page.css',
})
export class TournamentDrawDesignerPage implements OnDestroy, OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tournamentService = inject(TournamentService);
  private readonly drawService = inject(DivisionDrawService);
  private readonly gameService = inject(GameService);
  private readonly drawTypeService = inject(PDrawTypeService);
  private readonly attendeeService = inject(AttendeeService);
  private readonly confirmationService = inject(ConfirmationService);
  private messageTimeout: number | undefined;

  readonly tournament = signal<import('@tournament-manager/persistent-data-model').Tournament | null>(null);
  readonly draws = signal<DivisionDraw[]>([]);
  readonly drawTypes = signal<PDrawType[]>([]);
  readonly managers = signal<Attendee[]>([]);
  readonly selectedDivisionId = signal('');
  readonly selectedDrawId = signal('');
  readonly selectedPointCalculationId = signal('');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly message = signal('');
  readonly error = signal('');
  readonly loadError = signal('');
  readonly spreadTeamsAlgos = SPREAD_TEAMS_ALGOS;
  readonly outputTeamRankingStrategies = OUTPUT_TEAM_RANKING_STRATEGIES;
  managerEmail = '';

  /** Clears the pending success-message timeout when the page is destroyed. */
  ngOnDestroy(): void {
    this.clearMessageTimeout();
  }

  /** Loads the tournament, draw definitions, templates, and manager choices. */
  ngOnInit(): void {
    const tournamentId = this.route.snapshot.paramMap.get('tournamentId');
    if (!tournamentId) {
      this.loadError.set('Tournament identifier is missing.');
      this.loading.set(false);
      return;
    }
    forkJoin({
      tournament: this.tournamentService.byId(tournamentId).pipe(take(1)),
      draws: this.drawService.byTournament(tournamentId).pipe(take(1)),
      drawTypes: this.drawTypeService.enabled().pipe(take(1)),
      managers: this.attendeeService.findTournamentManager(tournamentId).pipe(take(1)),
    }).subscribe({
      next: ({ tournament, draws, drawTypes, managers }) => {
        if (!tournament) {
          this.router.navigate(['/tournament']);
          return;
        }
        this.tournament.set(tournament);
        this.draws.set(draws);
        this.drawTypes.set(drawTypes);
        this.managers.set(managers);
        const divisionId = tournament.divisions[0]?.id ?? '';
        this.selectedDivisionId.set(divisionId);
        this.selectFirstDraw(divisionId, draws);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        console.error('Unable to load draw designer', err);
        this.loadError.set('Unable to load the draw designer.');
        this.loading.set(false);
      },
    });
  }

  /** Returns divisions available in the loaded tournament. */
  divisions(): Division[] {
    return this.tournament()?.divisions ?? [];
  }

  /** Returns the draw currently selected in the toolbar. */
  selectedDraw(): DivisionDraw | undefined {
    return this.draws().find((draw) => draw.id === this.selectedDrawId());
  }

  /** Returns the selected division. */
  selectedDivision(): Division | undefined {
    return this.divisions().find((division) => division.id === this.selectedDivisionId());
  }

  /** Changes the division and selects its first draw, if any. */
  divisionChanged(divisionId: string): void {
    this.selectedDivisionId.set(divisionId);
    this.selectFirstDraw(divisionId, this.draws());
  }

  /** Selects an existing draw. */
  drawChanged(drawId: string): void {
    this.selectedDrawId.set(drawId);
    this.selectFirstPointCalculation();
  }

  /** Returns draws belonging to the selected division. */
  divisionDraws(divisionId = this.selectedDivisionId()): DivisionDraw[] {
    return this.draws().filter((draw) => draw.divisionId === divisionId);
  }

  /** Reports whether the current draw is the active draw for its division. */
  isActive(draw = this.selectedDraw()): boolean {
    return !!draw && (this.tournament()?.currentDrawDivisionIds ?? []).includes(draw.id);
  }

  /** Reports whether editing is locked by a running or finished step. */
  isDrawLocked(draw = this.selectedDraw()): boolean {
    return draw?.steps.some((step) => step.status === 'RUNNING' || step.status === 'FINISHED') ?? false;
  }

  /** Creates and immediately persists a new draw with a client-generated name. */
  createDraw(): void {
    const tournament = this.tournament();
    const division = this.selectedDivision();
    if (!tournament || !division) return;
    const draw: DivisionDraw = {
      id: '',
      lastChange: Date.now(),
      tournamentId: tournament.id,
      divisionId: division.id,
      name: this.randomDrawName(),
      steps: [],
      managerAttendeeIds: [...tournament.managerAttendeeIds],
      pointCalculations: [],
    };
    this.drawService.save(draw).subscribe({
      next: (saved) => {
        const draws = [...this.draws(), saved];
        this.draws.set(draws);
        this.selectedDrawId.set(saved.id);
        if (this.divisionDraws(division.id).length === 1) this.activateDraw(saved);
        this.showMessage('Draw created.');
      },
      error: (err: unknown) => this.reportError('Unable to create draw.', err),
    });
  }

  /** Activates exactly one draw for the selected division. */
  activateDraw(draw = this.selectedDraw()): void {
    const tournament = this.tournament();
    if (!draw || !tournament) return;
    const active = (tournament.currentDrawDivisionIds ?? []).filter((id) => {
      const candidate = this.draws().find((item) => item.id === id);
      return candidate?.divisionId !== draw.divisionId;
    });
    tournament.currentDrawDivisionIds = [...active, draw.id];
    this.tournamentService.save(tournament).subscribe({
      next: (saved) => {
        this.tournament.set(saved);
        this.showMessage('Draw activated.');
      },
      error: (err: unknown) => this.reportError('Unable to activate draw.', err),
    });
  }

  /** Removes the selected draw from the active draw list for its division. */
  deactivateDraw(draw = this.selectedDraw()): void {
    const tournament = this.tournament();
    if (!draw || !tournament || !this.isActive(draw)) return;
    tournament.currentDrawDivisionIds = (tournament.currentDrawDivisionIds ?? []).filter((id) => id !== draw.id);
    this.tournamentService.save(tournament).subscribe({
      next: (saved) => {
        this.tournament.set(saved);
        this.showMessage('Draw deactivated.');
      },
      error: (err: unknown) => this.reportError('Unable to deactivate draw.', err),
    });
  }

  /** Deletes a draw unless its structure already contains played or scheduled work. */
  deleteDraw(): void {
    const draw = this.selectedDraw();
    if (
      !draw ||
      this.isActive(draw) ||
      draw.steps.some((step) => ['PLANIFIED', 'RUNNING', 'FINISHED'].includes(step.status))
    ) {
      this.error.set('An active draw or a draw containing scheduled or played matches cannot be deleted.');
      return;
    }
    this.drawService
      .delete(draw.id)
      .then(() => {
        const draws = this.draws().filter((item) => item.id !== draw.id);
        this.draws.set(draws);
        this.selectFirstDraw(this.selectedDivisionId(), draws);
        this.showMessage('Draw deleted.');
      })
      .catch((err: unknown) => this.reportError('Unable to delete draw.', err));
  }

  /** Generates the draw games for a draft step and persists its drawn status. */
  drawStep(step: Step): void {
    const draw = this.selectedDraw();
    const division = this.selectedDivision();
    const stepPosition = draw?.steps.findIndex((candidate) => candidate.id === step.id) ?? -1;
    if (!draw || !division || step.status !== 'DRAFT' || stepPosition < 0) return;
    try {
      this.drawService.drawStep(draw, division, stepPosition);
      this.drawService.save(draw).subscribe({
        next: (saved) => {
          this.draws.update((draws) => draws.map((item) => (item.id === saved.id ? saved : item)));
          this.showMessage('Step drawn.');
        },
        error: (err: unknown) => this.reportError('Unable to draw the step.', err),
      });
    } catch (err: unknown) {
      this.reportError('Unable to draw the step.', err);
    }
  }

  /** Removes a draft step after confirmation and persists the updated step order. */
  deleteStep(step: Step): void {
    const draw = this.selectedDraw();
    if (!draw || step.status !== 'DRAFT') return;
    this.confirmationService.confirm({
      header: 'Delete step',
      message: `Delete ${step.name}? This action cannot be undone.`,
      icon: 'pi pi-exclamation-triangle',
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
      acceptButtonProps: { label: 'Delete', severity: 'danger' },
      accept: () => this.persistStepDeletion(draw, step),
    });
  }

  /** Deletes a pre-running step's games and returns its structure to draft mode. */
  returnStepToDraft(step: Step): void {
    if (!['DRAWN', 'PLANIFYING', 'PLANIFIED'].includes(step.status)) return;
    this.confirmationService.confirm({
      header: 'Return step to draft',
      message: 'Returning this step to draft will permanently delete its games and draw games. Continue?',
      icon: 'pi pi-exclamation-triangle',
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
      acceptButtonProps: { label: 'Return to draft', severity: 'secondary' },
      accept: () => this.persistReturnStepToDraft(step),
    });
  }

  /** Deletes the pre-running step games and persists the draft status after confirmation. */
  private persistReturnStepToDraft(step: Step): void {
    const draw = this.selectedDraw();
    const tournament = this.tournament();
    if (!draw || !tournament) return;
    this.gameService
      .byTournament(tournament.id)
      .pipe(take(1))
      .subscribe({
        next: (games) => {
          const drawGameIds = new Set(step.groups.flatMap((group) => group.games.map((drawGame) => drawGame.id)));
          const linkedGameIds = new Set(
            step.groups.flatMap((group) => group.games.map((drawGame) => drawGame.gameId).filter(Boolean)),
          );
          const linkedGames = games.filter(
            (game) =>
              game.scheduleInfo?.stepId === step.id ||
              drawGameIds.has(game.scheduleInfo?.drawGameId ?? '') ||
              linkedGameIds.has(game.id),
          );
          Promise.all(linkedGames.map((game) => this.gameService.delete(game.id)))
            .then(() => {
              step.groups.forEach((group) => {
                group.games = [];
                group.teams = [];
                if ('ouputTeams' in group.specificData) {
                  (group.specificData as SpecificDataCup).ouputTeams  = [];
                }
              });
              step.outputTeams = [];
              step.status = 'DRAFT';
              this.drawService.save(draw).subscribe({
                next: (saved) => {
                  this.draws.update((draws) => draws.map((item) => (item.id === saved.id ? saved : item)));
                  this.showMessage('Step returned to draft.');
                },
                error: (err: unknown) => this.reportError('Unable to return the step to draft.', err),
              });
            })
            .catch((err: unknown) => this.reportError('Unable to delete the step games.', err));
        },
        error: (err: unknown) => this.reportError('Unable to load the step games.', err),
      });
  }

  /** Cancels a step without changing its draw games or real games. */
  cancelStep(step: Step): void {
    const draw = this.selectedDraw();
    if (!draw || step.status !== 'RUNNING') return;
    step.status = 'CANCELED';
    this.drawService.save(draw).subscribe({
      next: (saved) => {
        this.draws.update((draws) => draws.map((item) => (item.id === saved.id ? saved : item)));
        this.showMessage('Step canceled.');
      },
      error: (err: unknown) => this.reportError('Unable to cancel the step.', err),
    });
  }

  /** Persists the selected draw and its edited configuration. */
  save(): void {
    this.error.set('');
    this.clearMessage();
    const draw = this.selectedDraw();
    if (!draw) return;
    if (!draw.steps.length) {
      this.error.set('At least one step is required before saving the draw.');
      return;
    }
    if (draw.steps.some((step) => step.drawType.requirePointCalculationConfig) && !draw.pointCalculations.length) {
      this.error.set('At least one point calculation is required by the configured steps.');
      return;
    }
    this.saving.set(true);
    this.drawService.save(draw).subscribe({
      next: (saved) => {
        this.draws.update((draws) => draws.map((item) => (item.id === saved.id ? saved : item)));
        this.saving.set(false);
        this.showMessage('Draw saved.');
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.reportError('Unable to save draw.', err);
      },
    });
  }

  /** Adds an existing tournament manager to the selected draw by email. */
  addDrawManager(draw: DivisionDraw): void {
    const email = this.managerEmail.trim().toLowerCase();
    const manager = this.managers().find((item) => item.person?.email?.toLowerCase() === email);
    if (!manager) {
      this.error.set('The email must belong to an existing tournament manager.');
      return;
    }
    if (!draw.managerAttendeeIds.includes(manager.id)) {
      draw.managerAttendeeIds = [...draw.managerAttendeeIds, manager.id];
    }
    this.managerEmail = '';
    this.error.set('');
  }

  /** Removes a manager from the selected draw without deleting the attendee. */
  removeDrawManager(draw: DivisionDraw, managerId: string): void {
    draw.managerAttendeeIds = draw.managerAttendeeIds.filter((id) => id !== managerId);
  }

  /** Returns the tournament manager identified by an attendee identifier. */
  managerById(managerId: string): Attendee | undefined {
    return this.managers().find((manager) => manager.id === managerId);
  }

  /** Returns a manager's display name, falling back to the email when unavailable. */
  managerName(manager: Attendee): string {
    const name = `${manager.person?.firstName ?? ''} ${manager.person?.lastName ?? ''}`.trim();
    return name || manager.person?.email || manager.id;
  }

  /** Adds a point calculation to the selected draw. */
  addPointCalculation(): void {
    const draw = this.selectedDraw();
    if (!draw) return;
    this.error.set('');
    const pointCalculation: PointCalculation = {
      id: crypto.randomUUID(),
      name: 'New calculation',
      winPoint: 0,
      lostPoint: 0,
      drawPoint: 0,
    };
    draw.pointCalculations.push(pointCalculation);
    this.selectedPointCalculationId.set(pointCalculation.id);
  }

  /** Removes the selected point calculation. */
  deletePointCalculation(): void {
    const draw = this.selectedDraw();
    if (!draw) return;
    draw.pointCalculations = draw.pointCalculations.filter((item) => item.id !== this.selectedPointCalculationId());
    this.selectFirstPointCalculation();
  }

  /** Moves a team up or down in the first-step input ranking. */
  moveTeam(index: number, offset: -1 | 1): void {
    const draw = this.selectedDraw();
    const firstStep = draw?.steps[0];
    if (!firstStep) return;
    const target = index + offset;
    if (target < 0 || target >= firstStep.inputTeams.length) return;
    [firstStep.inputTeams[index], firstStep.inputTeams[target]] = [
      firstStep.inputTeams[target],
      firstStep.inputTeams[index],
    ];
  }

  /** Adds a draft step using the first compatible persisted draw type. */
  addStep(): void {
    const draw = this.selectedDraw();
    const division = this.selectedDivision();
    const drawType = this.compatibleDrawTypes()[0];
    if (!draw || !division || this.isDrawLocked(draw)) return;
    if (!drawType) {
      this.error.set('No compatible draw type is available for this division.');
      return;
    }

    const position = draw.steps.length;
    const { id: _drawTypeId, ...drawDefinition } = drawType;
    const inputTeams =
      position === 0
        ? division.teams.map((team, rank): TeamReference => ({
            teamId: team.id,
            rank: rank + 1,
            teamSelectorType: 'TEAM_ID',
          }))
        : [];
    draw.steps.push({
      id: crypto.randomUUID(),
      status: 'DRAFT',
      position,
      name: `Step ${position + 1}`,
      drawType: drawDefinition,
      spreadTeamsAlgo: 'Random',
      inputTeams,
      groups: drawType.groups.map((definition, groupPosition): Group => ({
        id: crypto.randomUUID(),
        position: groupPosition,
        type: definition.groupType,
        name: String.fromCharCode(65 + groupPosition),
        games: [],
        teams: [],
        specificData: {},
      })),
      outputTeams: [],
      ouputTeamRankingStrategy: 'GROUP_ORDER',
    });
  }

  /** Returns the first step's ranked teams, falling back to division order. */
  inputTeams(draw = this.selectedDraw()): TeamReference[] {
    const division = this.selectedDivision();
    const firstStep = draw?.steps[0];
    if (firstStep) return firstStep.inputTeams;
    return (division?.teams ?? []).map((team, rank) => ({
      teamId: team.id,
      rank: rank + 1,
      teamSelectorType: 'TEAM_ID',
    }));
  }

  /** Returns the configured draw type for a step. */
  drawType(step: Step): DrawType | undefined {
    return step.drawType;
  }

  /** Returns the persisted template identifier matching a step's draw definition. */
  stepDrawTypeId(step: Step): string | undefined {
    return this.drawTypes().find(
      (item) => item.drawName === step.drawType.drawName && item.nbTeam === step.drawType.nbTeam,
    )?.id;
  }

  /** Returns draw templates compatible with the selected division team count. */
  compatibleDrawTypes(): PDrawType[] {
    return this.drawTypes().filter((drawType) => drawType.nbTeam === (this.selectedDivision()?.teams.length ?? 0));
  }

  /** Replaces a step's group configuration without generating draw games. */
  drawTypeChanged(step: Step, drawTypeId: string): void {
    const drawType = this.drawTypes().find((item) => item.id === drawTypeId);
    if (!drawType || this.isStepLocked(step)) return;
    const { id: _drawTypeId, ...drawDefinition } = drawType;
    step.drawType = drawDefinition;
    step.groups = drawType.groups.map((definition, position): Group => ({
      id: crypto.randomUUID(),
      position,
      type: definition.groupType,
      name: String.fromCharCode(65 + position),
      games: [],
      teams: [],
      specificData: {},
    }));
  }

  /** Applies neutral group names from the shared group-name definitions. */
  useNeutralGroupNames(step: Step): void {
    this.renameGroups(step, 'neutralName');
  }

  /** Applies ranked group names from the shared group-name definitions. */
  useRankedGroupNames(step: Step): void {
    this.renameGroups(step, 'rankedName');
  }

  /** Reports whether a step requires an explicit lifecycle action before editing. */
  isStepLocked(step: Step): boolean {
    return step.status !== 'DRAFT';
  }

  /** Returns the selected point calculation. */
  selectedPointCalculation(): PointCalculation | undefined {
    return this.selectedDraw()?.pointCalculations.find((item) => item.id === this.selectedPointCalculationId());
  }

  /** Returns the display name of a ranked team. */
  teamName(teamId: string): string {
    return this.selectedDivision()?.teams.find((team) => team.id === teamId)?.name ?? teamId;
  }

  private renameGroups(step: Step, nameType: 'neutralName' | 'rankedName'): void {
    if (this.isStepLocked(step)) return;
    step.groups.forEach((group) => {
      const definition = GroupNames.find((item) => item.position === group.position);
      if (definition) group.name = definition[nameType];
    });
  }

  private selectFirstDraw(divisionId: string, draws: DivisionDraw[]): void {
    this.selectedDrawId.set(draws.find((draw) => draw.divisionId === divisionId)?.id ?? '');
    this.selectFirstPointCalculation();
  }

  /** Displays a success message and schedules it to disappear after three seconds. */
  private showMessage(message: string): void {
    this.clearMessageTimeout();
    this.message.set(message);
    this.messageTimeout = window.setTimeout(() => {
      this.message.set('');
      this.messageTimeout = undefined;
    }, SUCCESS_MESSAGE_DURATION_MS);
  }

  /** Clears the success message and any pending timeout. */
  private clearMessage(): void {
    this.clearMessageTimeout();
    this.message.set('');
  }

  /** Cancels the pending success-message timeout. */
  private clearMessageTimeout(): void {
    if (this.messageTimeout !== undefined) {
      window.clearTimeout(this.messageTimeout);
      this.messageTimeout = undefined;
    }
  }

  private selectFirstPointCalculation(): void {
    this.selectedPointCalculationId.set(this.selectedDraw()?.pointCalculations[0]?.id ?? '');
  }

  /** Persists the removal of a confirmed draft step and restores it if saving fails. */
  private persistStepDeletion(draw: DivisionDraw, step: Step): void {
    const previousSteps = draw.steps;
    draw.steps = previousSteps
      .filter((candidate) => candidate.id !== step.id)
      .map((candidate, position) => ({ ...candidate, position }));
    this.drawService.save(draw).subscribe({
      next: (saved) => {
        this.draws.update((draws) => draws.map((item) => (item.id === saved.id ? saved : item)));
        this.showMessage('Step deleted.');
      },
      error: (err: unknown) => {
        draw.steps = previousSteps;
        this.reportError('Unable to delete the step.', err);
      },
    });
  }

  private randomDrawName(): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  }

  private reportError(message: string, error: unknown): void {
    console.error(message, error);
    this.error.set(message);
  }
}
