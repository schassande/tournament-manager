import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  Day,
  Division,
  DivisionDraw,
  DrawGame,
  Game,
  Group,
  Step,
  StepStatus,
  Team,
  TeamReference,
  Timeslot,
  Tournament,
} from '@tournament-manager/persistent-data-model';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { firstValueFrom, forkJoin, take } from 'rxjs';
import { DivisionDrawService } from '../../service/division-draw.service';
import { fieldsForDay, hasTeamConflict, knownTeamId, PlanningDrawGame } from '../../service/draw-planning.service';
import { GameService } from '../../service/game.service';
import { computeStepStatus, normalizeStepStatus } from '../../service/step-lifecycle.service';
import { TournamentService } from '../../service/tournament.service';
import { ref } from 'firebase/storage';

interface PlanningCell {
  timeslot: Timeslot;
  fieldId: string;
  game?: Game;
  drawGame?: PlanningDrawGame;
}

interface HighlightOption {
  label: string;
  key: string;
  kind: 'division' | 'step' | 'group' | 'team';
  id: string;
}

/** Step states in which an active division draw can be planned or run. */
const ACTIVE_DRAW_STEP_STATUSES: StepStatus[] = ['DRAWN', 'PLANIFYING', 'PLANIFIED', 'RUNNING', 'FINISHED'];

/** Allocates draw games to tournament timeslots and fields. */
@Component({
  selector: 'app-tournament-draw-planning',
  imports: [CommonModule, FormsModule, ButtonModule, MessageModule, SelectModule],
  templateUrl: './tournament-draw-planning.page.html',
  styleUrl: './tournament-draw-planning.page.css',
})
export class TournamentDrawPlanningPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly tournamentService = inject(TournamentService);
  private readonly drawService = inject(DivisionDrawService);
  private readonly gameService = inject(GameService);

  readonly tournament = signal<Tournament | null>(null);
  readonly draws = signal<DivisionDraw[]>([]);
  readonly games = signal<Game[]>([]);
  readonly selectedDayId = signal('');
  readonly selectedDivisionId = signal('');
  readonly selectedStepId = signal('');
  readonly selectedGroupId = signal('');
  readonly selectedHighlightKey = signal('');
  readonly loading = signal(true);
  readonly message = signal('');
  readonly error = signal('');
  readonly dragged = signal<PlanningDrawGame | undefined>(undefined);
  readonly planningCellWidth = '180px';

  /** Loads the tournament schedule, draws, and games used by the planner. */
  ngOnInit(): void {
    const tournamentId = this.route.snapshot.paramMap.get('tournamentId');
    if (!tournamentId) {
      this.error.set('Tournament identifier is missing.');
      this.loading.set(false);
      return;
    }
    forkJoin({
      tournament: this.tournamentService.byId(tournamentId).pipe(take(1)),
      draws: this.drawService.byTournament(tournamentId).pipe(take(1)),
      games: this.gameService.byTournament(tournamentId).pipe(take(1)),
    }).subscribe({
      next: ({ tournament, draws, games }) => {
        if (!tournament) {
          this.error.set('Tournament not found.');
          this.loading.set(false);
          return;
        }
        this.tournament.set(tournament);
        this.draws.set(draws);
        this.games.set(games);
        this.selectedDayId.set(tournament.days[0]?.id ?? '');
        this.selectedDivisionId.set(this.divisions()[0]?.id ?? '');
        this.selectFirstFilters();
        this.repairPersistedPlanning(draws, games);
        this.loading.set(false);
      },
      error: (cause: unknown) => {
        console.error('Unable to load draw planning', cause);
        this.error.set('Unable to load draw planning.');
        this.loading.set(false);
      },
    });
  }

  /** Returns the selected day. */
  selectedDay(): Day | undefined {
    return this.tournament()?.days.find((day) => day.id === this.selectedDayId());
  }

  /** Returns the fields available on the selected day. */
  fields() {
    const tournament = this.tournament();
    return tournament ? fieldsForDay(tournament, this.selectedDayId()) : [];
  }

  /** Returns the timeslots of the selected day without duplicate identifiers. */
  timeslots(): Timeslot[] {
    const seen = new Set<string>();
    return (this.selectedDay()?.parts ?? [])
      .flatMap((part) => part.timeslots)
      .filter((timeslot) => {
        if (seen.has(timeslot.id)) return false;
        seen.add(timeslot.id);
        return true;
      });
  }

  /** Returns divisions with an active draw in a lifecycle state usable by the planner. */
  divisions(): Division[] {
    return (this.tournament()?.divisions ?? []).filter((division) =>
      this.isActivePlanningDraw(this.activeDrawForDivision(division.id)),
    );
  }

  /** Returns PrimeNG options for the day selector. */
  dayOptions(): Array<{ label: string; value: string }> {
    const formatter = new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      weekday: 'short',
    });
    return (this.tournament()?.days ?? []).map((day) => ({
      label: formatter.format(new Date(day.date * 1000)),
      value: day.id,
    }));
  }

  /** Returns steps in the selected division's active draw. */
  steps(): Step[] {
    return this.selectedDraw()?.steps ?? [];
  }

  /** Returns groups in the selected step. */
  groups(): Group[] {
    return this.steps().find((step) => step.id === this.selectedStepId())?.groups ?? [];
  }

  /** Returns PrimeNG options for the linked step selector. */
  stepOptions(): Array<{ label: string; value: string }> {
    return [{ label: 'All steps', value: '' }, ...this.steps().map((step) => ({ label: step.name, value: step.id }))];
  }

  /** Returns PrimeNG options for the linked group selector. */
  groupOptions(): Array<{ label: string; value: string }> {
    return [
      { label: 'All groups', value: '' },
      ...this.groups().map((group) => ({ label: group.name, value: group.id })),
    ];
  }

  /** Returns unallocated draw games matching the linked selection filters. */
  unallocatedDrawGames(): PlanningDrawGame[] {
    return this.selectedDivisionDrawGames().filter((item) => {
      if (item.drawGame.gameId) return false;
      if (item.divisionId !== this.selectedDivisionId()) return false;
      if (this.selectedStepId() && item.stepId !== this.selectedStepId()) return false;
      return !this.selectedGroupId() || item.groupId === this.selectedGroupId();
    });
  }

  /** Returns the match currently assigned to a planning cell. */
  cell(timeslotId: string, fieldId: string): PlanningCell {
    const game = this.games().find(
      (item) => item.dayId === this.selectedDayId() && item.timeslotId === timeslotId && item.fieldId === fieldId,
    );
    return {
      timeslot: this.timeslots().find((item) => item.id === timeslotId)!,
      fieldId,
      game,
      drawGame: game ? this.allPlanningDrawGames().find((item) => item.drawGame.gameId === game.id) : undefined,
    };
  }

  /** Builds the four levels of highlight choices required by the toolbar. */
  highlights(): HighlightOption[] {
    const options: HighlightOption[] = [{ label: 'All matches', key: '', kind: 'division', id: '' }];
    for (const draw of this.draws()) {
      const division = this.divisions().find((item) => item.id === draw.divisionId);
      if (!division) continue;
      options.push({ label: division.shortName, key: `division:${division.id}`, kind: 'division', id: division.id });
      for (const step of draw.steps) {
        options.push({
          label: `${division.shortName}-${step.name}`,
          key: `step:${step.id}`,
          kind: 'step',
          id: step.id,
        });
        for (const group of step.groups) {
          options.push({
            label: `${division.shortName}-${step.name}-${group.name}`,
            key: `group:${group.id}`,
            kind: 'group',
            id: group.id,
          });
        }
      }
      for (const team of division.teams) {
        options.push({
          label: `${division.shortName}-${team.shortName}`,
          key: `team:${team.id}`,
          kind: 'team',
          id: team.id,
        });
      }
    }
    return options;
  }

  /** Returns whether a cell belongs to the active highlight. */
  isHighlighted(item: PlanningDrawGame | undefined): boolean {
    const key = this.selectedHighlightKey();
    if (!key || !item) return false;
    const [kind, id] = key.split(':');
    if (kind === 'division') return item.divisionId === id;
    if (kind === 'step') return item.stepId === id;
    if (kind === 'group') return item.groupId === id;
    return [item.drawGame.homeTeam, item.drawGame.awayTeam].some((reference) => knownTeamId(reference) === id);
  }

  /** Returns the category color used by an occupied planning cell. */
  divisionColor(item: PlanningDrawGame | undefined): string {
    return this.divisions().find((division) => division.id === item?.divisionId)?.backgroundColor ?? '#ffffff';
  }

  /** Updates the division filter and resets dependent filters. */
  divisionChanged(divisionId: string): void {
    this.selectedDivisionId.set(divisionId);
    this.selectedStepId.set('');
    this.selectedGroupId.set('');
    this.selectFirstFilters();
  }

  /** Updates the linked step filter. */
  stepChanged(stepId: string): void {
    this.selectedStepId.set(stepId);
    this.selectedGroupId.set('');
  }

  /** Starts dragging a draw game. */
  startDrag(item: PlanningDrawGame): void {
    this.dragged.set(item);
  }

  /** Allocates, moves, or swaps the dragged match at a planning cell. */
  drop(timeslotId: string, fieldId: string): void {
    const source = this.dragged();
    this.dragged.set(undefined);
    if (!source) return;
    const target = this.cell(timeslotId, fieldId).drawGame;
    if (!source.drawGame.gameId && target) {
      this.error.set('The selected cell is already occupied.');
      return;
    }
    void this.allocate(source, target, timeslotId, fieldId);
  }

  /** Deallocates an allocated match while keeping its real Game record. */
  deallocate(item: PlanningDrawGame | undefined): void {
    if (!item?.drawGame.gameId) return;
    const game = this.games().find((candidate) => candidate.id === item.drawGame.gameId);
    if (!game) return;
    const updatedGame = { ...game, dayId: '', timeslotId: '', fieldId: '' };
    const updatedDraw = this.updateDrawGame(item, { status: 'DRAWN' }, true);
    void Promise.all([
      firstValueFrom(this.gameService.save(updatedGame)),
      firstValueFrom(this.drawService.save(updatedDraw)),
    ])
      .then(async () => {
        this.games.update((games) => games.map((candidate) => (candidate.id === game.id ? updatedGame : candidate)));
        await this.persistLifecycleStatuses([updatedDraw], this.games());
        this.message.set('Match deallocated.');
      })
      .catch((cause: unknown) => this.reportError('Unable to deallocate match.', cause));
  }

  /** Returns a compact match display line using the division short name. */
  matchLine(item: PlanningDrawGame | undefined): string {
    return item ? item.drawGame.what : '';
  }

  /** Returns a team label, using ? for an unresolved draw reference. */
  teamLabel(item: PlanningDrawGame | undefined, side: 'homeTeam' | 'awayTeam'): string {
    if (!item) return '!';
    const reference: TeamReference = item.drawGame[side] as TeamReference;
    if (!reference) return '??';
    if (reference.teamId) {
      return reference.teamId ? (this.team(reference.teamId)?.shortName ?? reference.teamId) : '???';
    }
    switch (reference?.teamSelectorType) {
      case 'RANK_IN_GROUP':
        return this.rankName(reference.rank!) + ' of group ' + this.getGroupName(reference.groupId, item);
      case 'RANK_IN_STEP': {
        return this.rankName(reference.rank!) + ' of step ' + this.getStepName(reference.stepId, item);
      }
      case 'WINNER_OF':
        return 'Winner of ' + this.getGamewhat(reference.drawGameId, item);
      case 'LOSER_OF':
        return 'Loser of ' + this.getGamewhat(reference.drawGameId, item);
      default:
        return '?';
    }
  }
  rankName(rank: number | undefined): string {
    if (rank === undefined) return '?';
    switch (rank) {
      case 1:
      case 11:
      case 21:
      case 31:
      case 41:
      case 51:
      case 61:
        return rank + 'st';
      case 2:
        return rank + 'nd';
      case 12:
      case 22:
      case 32:
      case 42:
      case 52:
      case 62:
      case 3:
        return rank + 'rd';
      case 13:
      case 23:
      case 33:
      case 43:
      case 53:
      case 63:
      default:
        return rank + 'th';
    }
  }

  getGroupName(groupId: string | undefined, item: PlanningDrawGame): string {
    if (!groupId) return '?';
    const draw: DivisionDraw | undefined = this.draws().find((d) => d.id === item.drawId);
    if (!draw) return 'Group';
    let group: Group | undefined;
    draw.steps.find((s) => {
      group = s.groups.find((g) => g.id === groupId);
      return group;
    });
    return group ? group.name : 'Group';
  }
  getStepName(stepId: string | undefined, item: PlanningDrawGame): string {
    if (!stepId) return '?';
    const draw: DivisionDraw | undefined = this.draws().find((d) => d.id === item.drawId);
    if (!draw) return 'Step';
    const step: Step | undefined = draw.steps.find((s) => s.id === stepId);
    if (!step) return 'Step';
    return step.name;
  }
  getGamewhat(drawGameId: string | undefined, item: PlanningDrawGame): string {
    if (!drawGameId) return '?';
    const draw: DivisionDraw | undefined = this.draws().find((d) => d.id === item.drawId);
    if (!draw) return 'Game';
    let what = '?';
    draw.steps.find((s) => {
      return s.groups.find((g) => {
        const game = g.games.find((g) => g.id === drawGameId);
        if (game) what = game.what;
        return game;
      });
    });
    return what;
  }

  /** Returns the allocation percentage for all draw games. */
  allocationPercent(): number {
    const all = this.activePlanningDrawGames();
    if (!all.length) return 100;
    return Math.round((all.filter((item) => item.drawGame.status === 'PLANIFIED').length / all.length) * 100);
  }

  /** Returns divisions whose active draw is missing or has no active lifecycle step. */
  missingActiveDrawDivisionNames(): string[] {
    return (this.tournament()?.divisions ?? [])
      .filter((division) => !this.isActivePlanningDraw(this.activeDrawForDivision(division.id)))
      .map((division) => division.shortName);
  }

  /** Ends a drag that was not dropped on a planning cell by deallocating it. */
  endDrag(): void {
    const source = this.dragged();
    this.dragged.set(undefined);
    if (source?.drawGame.gameId) this.deallocate(source);
  }

  private selectedDraw(): DivisionDraw | undefined {
    const activeIds = new Set(this.tournament()?.currentDrawDivisionIds ?? []);
    return (
      this.draws().find((draw) => draw.divisionId === this.selectedDivisionId() && activeIds.has(draw.id)) ??
      this.draws().find((draw) => draw.divisionId === this.selectedDivisionId())
    );
  }

  /** Returns draw games from the active draw of the selected division. */
  private selectedDivisionDrawGames(): PlanningDrawGame[] {
    const draw = this.selectedDraw();
    return draw ? this.drawGames(draw) : [];
  }

  /** Returns draw games from the active draw of every tournament division. */
  private allPlanningDrawGames(): PlanningDrawGame[] {
    return this.divisions().flatMap((division) => {
      const draw = this.drawForDivision(division.id);
      return draw ? this.drawGames(draw) : [];
    });
  }

  /** Returns games from active draws whose lifecycle is eligible for allocation reporting. */
  private activePlanningDrawGames(): PlanningDrawGame[] {
    const activeDrawIds = new Set(this.tournament()?.currentDrawDivisionIds ?? []);
    return this.draws()
      .filter((draw) => activeDrawIds.has(draw.id) && this.isActivePlanningDraw(draw))
      .flatMap((draw) => this.drawGames(draw));
  }

  /** Returns the draw explicitly activated for a division. */
  private activeDrawForDivision(divisionId: string): DivisionDraw | undefined {
    const activeDrawIds = new Set(this.tournament()?.currentDrawDivisionIds ?? []);
    return this.draws().find((draw) => draw.divisionId === divisionId && activeDrawIds.has(draw.id));
  }

  /** Returns whether a draw is active and has at least one eligible lifecycle step. */
  private isActivePlanningDraw(draw: DivisionDraw | undefined): boolean {
    return Boolean(
      draw &&
      (this.tournament()?.currentDrawDivisionIds ?? []).includes(draw.id) &&
      draw.steps.some((step) => ACTIVE_DRAW_STEP_STATUSES.includes(computeStepStatus(step, this.games()))),
    );
  }

  /** Returns the active draw for a division, falling back to its only available draw. */
  private drawForDivision(divisionId: string): DivisionDraw | undefined {
    const activeIds = new Set(this.tournament()?.currentDrawDivisionIds ?? []);
    return (
      this.draws().find((draw) => draw.divisionId === divisionId && activeIds.has(draw.id)) ??
      this.draws().find((draw) => draw.divisionId === divisionId)
    );
  }

  /** Flattens one draw into the planning view model used by the list and grid. */
  private drawGames(draw: DivisionDraw): PlanningDrawGame[] {
    return draw.steps.flatMap((step) =>
      step.groups.flatMap((group) =>
        group.games.map((drawGame) => ({
          drawId: draw.id,
          divisionId: draw.divisionId,
          stepId: step.id,
          stepName: step.name,
          groupId: group.id,
          groupName: group.name,
          drawGame,
        })),
      ),
    );
  }

  private team(teamId: string): Team | undefined {
    return this.tournament()
      ?.divisions.flatMap((division) => division.teams)
      .find((team) => team.id === teamId);
  }

  private selectFirstFilters(): void {
    const step = this.steps()[0];
    this.selectedStepId.set(step?.id ?? '');
    this.selectedGroupId.set('');
  }

  private async allocate(
    source: PlanningDrawGame,
    target: PlanningDrawGame | undefined,
    timeslotId: string,
    fieldId: string,
  ): Promise<void> {
    const tournament = this.tournament();
    if (!tournament) return;
    const scheduleId = tournament.currentScheduleId ?? '';
    const sourceGame = source.drawGame.gameId
      ? this.games().find((game) => game.id === source.drawGame.gameId)
      : undefined;
    const targetGame = target?.drawGame.gameId
      ? this.games().find((game) => game.id === target.drawGame.gameId)
      : undefined;
    const location = {
      tournamentId: tournament.id,
      scheduleId,
      divisionId: source.divisionId,
      dayId: this.selectedDayId(),
      timeslotId,
      fieldId,
    };
    const allocatedSource: Game = sourceGame
      ? { ...sourceGame, ...location }
      : {
          id: '',
          lastChange: Date.now(),
          ...location,
          homeTeamId: knownTeamId(source.drawGame.homeTeam),
          awayTeamId: knownTeamId(source.drawGame.awayTeam),
          what: source.drawGame.what,
          resultRequired: source.drawGame.resultRequired,
          scheduleInfo: {
            divisionDrawId: source.drawId,
            stepId: source.stepId,
            groupId: source.groupId,
            drawGameId: source.drawGame.id,
          },
        };
    if (allocatedSource.homeTeamId === undefined) delete allocatedSource.homeTeamId;
    if (allocatedSource.awayTeamId === undefined) delete allocatedSource.awayTeamId;
    if (allocatedSource.resultRequired === undefined) delete allocatedSource.resultRequired;
    const otherGames = this.games().filter((game) => game.id !== sourceGame?.id && game.id !== targetGame?.id);
    if (hasTeamConflict(allocatedSource, otherGames)) {
      this.error.set('A team cannot play on two fields in the same timeslot.');
      return;
    }
    try {
      const persistedSource = await firstValueFrom(this.gameService.save(allocatedSource));
      if (targetGame && sourceGame) {
        const sourceLocation = {
          dayId: sourceGame.dayId,
          timeslotId: sourceGame.timeslotId,
          fieldId: sourceGame.fieldId,
        };
        await firstValueFrom(this.gameService.save({ ...targetGame, ...sourceLocation }));
      }
      const updatedSource = this.updateDrawGame(source, { gameId: persistedSource.id, status: 'PLANIFIED' });
      await firstValueFrom(this.drawService.save(updatedSource));
      if (target && targetGame && sourceGame) {
        await firstValueFrom(this.drawService.save(this.updateDrawGame(target, { status: 'PLANIFIED' })));
      }
      const games = this.games().filter((game) => game.id !== sourceGame?.id && game.id !== targetGame?.id);
      const updatedGames = [
        ...games,
        persistedSource,
        ...(targetGame && sourceGame
          ? [{ ...targetGame, dayId: sourceGame.dayId, timeslotId: sourceGame.timeslotId, fieldId: sourceGame.fieldId }]
          : []),
      ];
      this.games.set(updatedGames);
      const affectedDraws = [this.draws().find((draw) => draw.id === source.drawId)].filter(
        (draw): draw is DivisionDraw => Boolean(draw),
      );
      if (target && target.drawId !== source.drawId) {
        const targetDraw = this.draws().find((draw) => draw.id === target.drawId);
        if (targetDraw) affectedDraws.push(targetDraw);
      }
      await this.persistLifecycleStatuses(affectedDraws, updatedGames);
      this.message.set('Match allocated.');
      this.error.set('');
    } catch (cause: unknown) {
      this.reportError('Unable to allocate match.', cause);
    }
  }

  private updateDrawGame(item: PlanningDrawGame, patch: Partial<DrawGame>, removeGameId = false): DivisionDraw {
    const draw = structuredClone(this.draws().find((candidate) => candidate.id === item.drawId)!);
    const group = draw.steps
      .find((step) => step.id === item.stepId)
      ?.groups.find((candidate) => candidate.id === item.groupId);
    const drawGame = group?.games.find((candidate) => candidate.id === item.drawGame.id);
    if (drawGame) {
      if (removeGameId) delete drawGame.gameId;
      Object.assign(drawGame, patch);
    }
    this.draws.update((draws) => draws.map((candidate) => (candidate.id === draw.id ? draw : candidate)));
    return draw;
  }

  private repairPersistedPlanning(draws: DivisionDraw[], games: Game[]): void {
    // Flatten all draw games so persisted references can be checked against the loaded tournament data.
    const drawGames = draws.flatMap((draw) =>
      draw.steps.flatMap((step) => step.groups.flatMap((group) => group.games)),
    );
    const knownGameIds = new Set(games.map((game) => game.id));
    const validLocations = new Set(
      this.tournament()?.days.flatMap((day) =>
        day.parts.flatMap((part) => part.timeslots.map((slot) => `${day.id}:${slot.id}`)),
      ) ?? [],
    );
    const validFields = new Set(this.tournament()?.fields.map((field) => field.id) ?? []);
    let repaired = false;
    const changedDraws = new Set<string>();
    const clearedGames: Game[] = [];
    // Remove allocations pointing to missing games, invalid timeslots, or unknown fields.
    for (const drawGame of drawGames) {
      const game = drawGame.gameId ? games.find((candidate) => candidate.id === drawGame.gameId) : undefined;
      if (
        drawGame.gameId &&
        (!game || !validLocations.has(`${game.dayId}:${game.timeslotId}`) || !validFields.has(game.fieldId))
      ) {
        if (game) clearedGames.push({ ...game, dayId: '', timeslotId: '', fieldId: '' });
        delete drawGame.gameId;
        drawGame.status = 'DRAWN';
        repaired = true;
        const owner = draws.find((draw) =>
          draw.steps.some((step) => step.groups.some((group) => group.games.includes(drawGame))),
        );
        if (owner) changedDraws.add(owner.id);
      }
    }
    // Group valid allocated games by timeslot to detect teams scheduled twice at the same time.
    const drawGameByGameId = new Map(
      drawGames.filter((drawGame) => drawGame.gameId).map((drawGame) => [drawGame.gameId!, drawGame]),
    );
    const gamesByTimeslot = new Map<string, Game[]>();
    for (const game of games) {
      if (!game.dayId || !game.timeslotId || !drawGameByGameId.has(game.id)) continue;
      const key = `${game.dayId}:${game.timeslotId}`;
      gamesByTimeslot.set(key, [...(gamesByTimeslot.get(key) ?? []), game]);
    }
    for (const slotGames of gamesByTimeslot.values()) {
      const seenTeams = new Set<string>();
      for (const game of [...slotGames].sort((left, right) => left.lastChange - right.lastChange)) {
        const teams = [game.homeTeamId, game.awayTeamId].filter((teamId): teamId is string => Boolean(teamId));
        if (teams.some((teamId) => seenTeams.has(teamId))) {
          const drawGame = drawGameByGameId.get(game.id);
          if (drawGame) {
            clearedGames.push({ ...game, dayId: '', timeslotId: '', fieldId: '' });
            delete drawGame.gameId;
            drawGame.status = 'DRAWN';
            const owner = draws.find((draw) =>
              draw.steps.some((step) => step.groups.some((group) => group.games.includes(drawGame))),
            );
            if (owner) changedDraws.add(owner.id);
            repaired = true;
          }
          continue;
        }
        teams.forEach((teamId) => seenTeams.add(teamId));
      }
    }
    // Delete real game records that still look like draw allocations but are no longer referenced.
    const referenced = new Set(drawGames.map((drawGame) => drawGame.gameId).filter(Boolean));
    for (const game of games) {
      if (game.scheduleInfo?.drawGameId && !referenced.has(game.id) && knownGameIds.has(game.id)) {
        void this.gameService.delete(game.id);
        repaired = true;
      }
    }
    // Persist repairs and refresh lifecycle statuses after the cleanup.
    if (changedDraws.size) {
      void Promise.all(
        draws.filter((draw) => changedDraws.has(draw.id)).map((draw) => firstValueFrom(this.drawService.save(draw))),
      );
    }
    if (clearedGames.length) {
      void Promise.all(clearedGames.map((game) => firstValueFrom(this.gameService.save(game))));
    }
    void this.persistLifecycleStatuses(draws, games);
    if (repaired) this.message.set('Some invalid planning data was repaired while loading.');
  }

  /** Recomputes and persists lifecycle statuses for the supplied draws. */
  private async persistLifecycleStatuses(draws: DivisionDraw[], games: Game[]): Promise<void> {
    const changedDraws = draws.filter((draw) => {
      let changed = false;
      draw.steps.forEach((step) => {
        const nextStatus = computeStepStatus(step, games);
        if (step.status !== nextStatus) {
          step.status = nextStatus;
          changed = true;
        } else {
          step.status = normalizeStepStatus(step.status);
        }
      });
      return changed;
    });
    if (!changedDraws.length) return;
    await Promise.all(changedDraws.map((draw) => firstValueFrom(this.drawService.save(draw))));
    this.draws.update((current) => current.map((draw) => changedDraws.find((item) => item.id === draw.id) ?? draw));
  }

  private reportError(message: string, cause: unknown): void {
    console.error(message, cause);
    this.error.set(message);
  }
}
