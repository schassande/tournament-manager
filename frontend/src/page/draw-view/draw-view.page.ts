import { FormsModule } from '@angular/forms';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  Division,
  DivisionDraw,
  DrawGame,
  Game,
  Group,
  Step,
  StepStatus,
  TeamReference,
  Tournament,
} from '@tournament-manager/persistent-data-model';
import { AccordionModule } from 'primeng/accordion';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { forkJoin, take } from 'rxjs';
import { DrawCup4Rk2Component } from '../../component/draw/draw-cup4-rk2.components';
import { DrawCup4Rk4Component } from '../../component/draw/draw-cup4-rk4.components';
import { DrawCupRk4Component } from '../../component/draw/draw-cup-rk4.components';
import { DrawPoolComponent } from '../../component/draw/draw-pool.components';
import { DrawWinsComponent } from '../../component/draw/draw-wins.components';
import { DivisionDrawService } from '../../service/draw/division-draw.service';
import { GameService } from '../../service/game.service';
import { DateService } from '../../service/date.service';
import { TournamentService } from '../../service/tournament.service';
import { DrawCupService } from '../../service/draw/draw-cup.service';

/** A game row enriched with its linked schedule and display data. */
interface PublicGameRow {
  drawGame: DrawGame;
  game?: Game;
}

/** Displays the active tournament draw to authenticated and unauthenticated users. */
@Component({
  selector: 'app-draw-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AccordionModule,
    DrawCup4Rk2Component,
    DrawCup4Rk4Component,
    DrawCupRk4Component,
    DrawPoolComponent,
    DrawWinsComponent,
    FormsModule,
    MessageModule,
    SelectModule,
  ],
  templateUrl: './draw-view.page.html',
  styleUrl: './draw-view.page.css',
})
export class DrawViewPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly tournamentService = inject(TournamentService);
  private readonly drawService = inject(DivisionDrawService);
  private readonly drawCupService = inject(DrawCupService);
  private readonly gameService = inject(GameService);
  private readonly dateService = inject(DateService);

  readonly tournament = signal<Tournament | null>(null);
  readonly draws = signal<DivisionDraw[]>([]);
  readonly games = signal<Game[]>([]);
  readonly selectedDivisionId = signal('');
  readonly loading = signal(true);
  readonly error = signal('');

  readonly activeDivisions = computed(() => {
    const tournament = this.tournament();
    if (!tournament) return [];
    const activeDrawIds = new Set(tournament.currentDrawDivisionIds ?? []);
    return tournament.divisions.filter((division) =>
      this.draws().some((draw) => draw.divisionId === division.id && activeDrawIds.has(draw.id)),
    );
  });

  /** Loads the tournament, active draw definitions, and linked games. */
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
        this.selectedDivisionId.set(this.activeDivisions()[0]?.id ?? '');
        this.loading.set(false);
      },
      error: (cause: unknown) => {
        console.error('Unable to load public draw', cause);
        this.error.set('Unable to load the draw.');
        this.loading.set(false);
      },
    });
  }

  /** Returns the active draw for the selected division. */
  selectedDraw(): DivisionDraw | undefined {
    const activeIds = new Set(this.tournament()?.currentDrawDivisionIds ?? []);
    return this.draws().find((draw) => draw.divisionId === this.selectedDivisionId() && activeIds.has(draw.id));
  }

  /** Returns the selected division. */
  selectedDivision(): Division | undefined {
    return this.tournament()?.divisions.find((division) => division.id === this.selectedDivisionId());
  }

  /** Returns the selected draw steps that are ready to be shown publicly. */
  visibleSteps(): Step[] {
    return (this.selectedDraw()?.steps ?? [])
      .filter((step) => this.isPublicStepStatus(step.status))
      .sort((left, right) => left.position - right.position);
  }

  /** Returns the groups of a step ordered by their persisted position. */
  groups(step: Step): Group[] {
    return [...step.groups].sort((left, right) => left.position - right.position);
  }

  /** Returns a game row for a draw game, including its optional linked real game. */
  gameRow(drawGame: DrawGame): PublicGameRow {
    return {
      drawGame,
      game: drawGame.gameId ? this.games().find((game) => game.id === drawGame.gameId) : undefined,
    };
  }

  /** Returns the display name for a draw-game team reference. */
  teamName(reference: TeamReference, draw: DivisionDraw): string {
    const division = this.selectedDivision();
    return division ? this.drawCupService.teamLabel(reference, draw, division) : '—';
  }

  /** Returns the display name for a real game team, falling back to the draw reference. */
  gameTeamName(row: PublicGameRow, side: 'home' | 'away'): string {
    const teamId = side === 'home' ? row.game?.homeTeamId : row.game?.awayTeamId;
    const division = this.selectedDivision();
    if (teamId && division) return division.teams.find((team) => team.id === teamId)?.name ?? '—';
    const draw = this.selectedDraw();
    if (!draw) return '—';
    return this.teamName(side === 'home' ? row.drawGame.homeTeam : row.drawGame.awayTeam, draw);
  }

  /** Returns the formatted day date or an unavailable-value marker. */
  day(row: PublicGameRow): string {
    const day = this.tournament()?.days.find((item) => item.id === row.game?.dayId);
    return day ? new Intl.DateTimeFormat('fr-FR').format(new Date(day.date * 1000)) : '—';
  }

  /** Returns the formatted start time or an unavailable-value marker. */
  timeslot(row: PublicGameRow): string {
    const game = row.game;
    const timeslot = this.tournament()
      ?.days.flatMap((day) => day.parts.flatMap((part) => part.timeslots))
      .find((item) => item.id === game?.timeslotId);
    return timeslot ? this.dateService.toTime(timeslot.start) : '—';
  }

  /** Returns the field name or an unavailable-value marker. */
  field(row: PublicGameRow): string {
    return this.tournament()?.fields.find((field) => field.id === row.game?.fieldId)?.name ?? '—';
  }

  /** Returns the score for one side of a real game. */
  score(row: PublicGameRow, side: 'home' | 'away'): string | number {
    if (!row.game?.score) return '—';
    return side === 'home' ? row.game.score.homeTeamScore : row.game.score.awayTeamScore;
  }

  /** Returns the display status of the draw game. */
  status(row: PublicGameRow): string {
    return row.game?.scheduleInfo ? row.drawGame.status : row.drawGame.status || '—';
  }

  /** Returns whether a group type has a dedicated visualization widget. */
  supportsWidget(groupType: string): boolean {
    return (
      groupType === 'CUP4_RK2' ||
      groupType === 'CUP4_RK4' ||
      (groupType.startsWith('CUP') && groupType.endsWith('_RK4')) ||
      groupType.startsWith('POOL') ||
      groupType.endsWith('_WINS')
    );
  }

  /** Changes the division shown by the public draw view. */
  divisionChanged(divisionId: string): void {
    this.selectedDivisionId.set(divisionId);
  }

  /** Resolves a draw-game description for fallback team labels. */
  gameDescription(drawGameId: string | undefined): string {
    return this.drawCupService.getGamewhat(drawGameId, this.selectedDraw());
  }

  private isPublicStepStatus(status: StepStatus): boolean {
    return status === 'PLANIFIED' || status === 'RUNNING' || status === 'FINISHED';
  }
}
