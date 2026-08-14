import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TreeNode } from 'primeng/api';
import { TreeTableModule } from 'primeng/treetable';
import {
  FitRenamingConfig,
  Tournament,
} from '@tournament-manager/persistent-data-model';
import {
  FitCompetition,
  FITData,
  FitGame,
  FitImportService,
  FitReference,
  toCategory,
} from '../service/fit-import.service';
import { TournamentService } from '../service/tournament.service';

interface RenameRow {
  fitName: string;
  automatic: string;
  appName: string;
  kind: 'division' | 'team';
  division?: string;
}

/** Displays the FIT download and review workflow for the selected tournament. */
@Component({
  standalone: true,
  imports: [
    ButtonModule,
    CommonModule,
    DatePipe,
    FormsModule,
    InputTextModule,
    MessageModule,
    SelectModule,
    TableModule,
    TabsModule,
    TreeTableModule,
    ToggleSwitchModule,
  ],
  template: `
    <div class="fit-page">
      @if (error()) {
        <p-message severity="error">{{ error() }}</p-message>
      }
      <section class="form-row">
        <label for="fitCompetition">Competition</label>
        <p-select
          inputId="fitCompetition"
          [options]="competitions()"
          optionLabel="title"
          optionValue="slug"
          [(ngModel)]="competitionSlug"
          (onChange)="competitionChanged()"
          [disabled]="busy()"
          placeholder="Select a competition"
        />
      </section>
      <section class="form-row">
        <label for="fitSeason">Season</label>
        <p-select
          inputId="fitSeason"
          [options]="seasons()"
          optionLabel="title"
          optionValue="slug"
          [(ngModel)]="season"
          [disabled]="
            busy() ||
            seasonsLoading() ||
            !competitionSlug ||
            seasons().length === 0
          "
          placeholder="Select a season"
        />
      </section>
      <section class="form-row">
        <label for="fitTimeZone">Target time zone</label>
        <p-select
          inputId="fitTimeZone"
          [options]="timeZones"
          [(ngModel)]="targetTimeZone"
          [disabled]="busy()"
          [filter]="true"
          placeholder="Select a time zone"
        />
      </section>
      <section class="form-row">
        <label for="capitalizeTeamName">Uppercase team names</label>
        <p-toggleSwitch
          inputId="capitalizeTeamName"
          [(ngModel)]="capitalizeTeamName"
          [disabled]="busy()"
        />
      </section>
      <section class="form-row">
        <p-button
          label="Download"
          icon="pi pi-download"
          (click)="download()"
          [loading]="busy()"
          [disabled]="busy() || !competitionSlug || !season"
        />
      </section>
      @if (busy()) {
        <p-message severity="info">Downloading FIT data…</p-message>
      }
      @if (tournament?.fit?.lastImportDate; as lastImportDate) {
        <p-message severity="secondary">
          Last download: {{ lastImportDate | date: 'yyyy-MM-dd HH:mm:ss' }}
        </p-message>
      }
      @if (data(); as fit) {
        <p-message severity="info"
          >{{ fit.games.length }} games, {{ fit.excludedByes }} bye(s) excluded,
          {{ fit.incompleteGames.length }} incomplete.</p-message
        >
        @if (fit.unresolvedTeams.length) {
          <p-message severity="warn"
            >Unknown FIT team identifiers:
            {{ fit.unresolvedTeams.join(', ') }}</p-message
          >
        }
        <p-tabs value="renaming" scrollable="true" showNavigators="true">
          <p-tablist>
            <p-tab value="renaming">Renaming</p-tab>
            <p-tab value="timeslots">Timeslots</p-tab>
            @for (day of fit.days; track day.date) {
              <p-tab [value]="day.date">{{ day.date.replace('-', '/') }}</p-tab>
            }
            @if (fit.games.some(isUnassigned)) {
              <p-tab value="unassigned">Unassigned</p-tab>
            }
          </p-tablist>
          <p-tabpanels>
            <p-tabpanel value="renaming">
              <p-treeTable
                [value]="renamingTree"
                showGridlines
                styleClass="renaming-table"
                [tableStyle]="{ width: 'auto' }"
              >
                <ng-template #header>
                  <tr>
                    <th>FIT name</th>
                    <th>Automatic name</th>
                    <th>Manual name</th>
                  </tr></ng-template
                >
                <ng-template #body let-rowNode let-rowData="rowData">
                  <tr [ttRow]="rowNode">
                    <td>
                      <p-treeTableToggler [rowNode]="rowNode" />
                      {{ rowData.fitName }}
                    </td>
                    <td>{{ rowData.automatic }}</td>
                    <td>
                      <input
                        pInputText
                        [attr.aria-label]="
                          'Manual ' +
                          rowData.kind +
                          ' name for ' +
                          rowData.fitName
                        "
                        [(ngModel)]="rowData.appName"
                      />
                    </td>
                  </tr>
                </ng-template>
              </p-treeTable>

              <p-table
                [value]="fieldRows"
                showGridlines
                stripedRows
                styleClass="field-table"
                [tableStyle]="{ width: 'auto' }"
              >
                <ng-template #header>
                  <tr>
                    <th>FIT name</th>
                    <th>Manual name</th>
                  </tr>
                </ng-template>
                <ng-template #body let-row>
                  <tr>
                    <td>{{ row.fitName }}</td>
                    <td>
                      <input
                        pInputText
                        [attr.aria-label]="
                          'Manual field name for ' + row.fitName
                        "
                        [(ngModel)]="row.appName"
                      />
                    </td>
                  </tr>
                </ng-template>
              </p-table>
            </p-tabpanel>

            <p-tabpanel value="timeslots">
              <p-table
                [value]="timeslotRows(fit.days)"
                styleClass="timeslot-table"
                [tableStyle]="{ width: 'auto' }"
              >
                <ng-template #header>
                  <tr>
                    @for (day of fit.days; track day.date) {
                      <th>
                        <div>{{ day.date }}</div>
                        <div class="weekday-label">
                          {{ weekdayName(day.date) }}
                        </div>
                      </th>
                    }
                  </tr>
                </ng-template>
                <ng-template #body let-row>
                  <tr>
                    @for (day of fit.days; track day.date) {
                      <td>{{ day.timeslots[row.index] || '' }}</td>
                    }
                  </tr>
                </ng-template>
              </p-table>
            </p-tabpanel>

            @for (day of fit.days; track day.date) {
              <p-tabpanel [value]="day.date">
                <ng-container
                  *ngTemplateOutlet="
                    gamesTable;
                    context: { games: gamesForDay(fit.games, day.date) }
                  "
                >
                </ng-container>
              </p-tabpanel>
            }
            @if (fit.games.some(isUnassigned)) {
              <p-tabpanel value="unassigned">
                <ng-container
                  *ngTemplateOutlet="
                    gamesTable;
                    context: { games: unassignedGames(fit.games) }
                  "
                >
                </ng-container>
              </p-tabpanel>
            }
          </p-tabpanels>
        </p-tabs>
      }
    </div>
    <ng-template #gamesTable let-games="games">
      <div class="games-count">{{ games.length }} games</div>
      <p-table [value]="games" size="small" showGridlines stripedRows>
        <ng-template #header>
          <tr>
            <th>Time</th>
            <th>Field</th>
            <th>Division</th>
            <th>Type</th>
            <th>Home</th>
            <th>Away</th>
            <th>Status</th>
            <th>FIT id</th>
            <th>Changes</th>
          </tr>
        </ng-template>
        <ng-template #body let-game>
          <tr [class.incomplete]="game.incomplete">
            <td>{{ game.timeslot }}</td>
            <td>{{ game.field }}</td>
            <td>{{ game.division }}</td>
            <td>{{ game.gameType }}</td>
            <td>{{ game.teamHome }}</td>
            <td>{{ game.teamAway }}</td>
            <td>{{ game.status }}{{ game.washout ? ' (washout)' : '' }}</td>
            <td>{{ game.gameId }}</td>
            <td>{{ game.changes.join(', ') }}</td>
          </tr>
        </ng-template>
      </p-table>
    </ng-template>
  `,
  styles: [
    `
      .fit-page {
        padding: 20px 20px;
      }
      .form-row {
        display: flex;
        gap: 10px;
        align-items: center;
        flex-wrap: wrap;
        margin-bottom: 15px;
      }
      .form-row label {
        font-weight: 600;
        text-align: right;
        width: 160px;
      }
      .form-row p-button {
        margin-left: 160px;
      }
      .team-columns {
        display: flex;
        gap: 30px;
        flex-wrap: wrap;
      }
      .team-columns > div {
        min-width: 150px;
      }
      .timeslot-table {
        width: fit-content;
        max-width: 100%;
      }
      .timeslot-table .weekday-label {
        font-size: 0.8rem;
      }
      .timeslot-table :is(th, td) {
        text-align: center;
      }
      .field-table {
        width: fit-content;
        max-width: 100%;
      }
      .field-table :is(th, td) {
        text-align: center;
      }
      .renaming-table {
        width: fit-content;
        max-width: 100%;
      }
      .renaming-table :is(th, td) {
        text-align: center;
      }
      .renaming-table :is(th, td):first-child {
        text-align: left;
      }
      .renaming-table th:first-child {
        text-align: center;
      }
      .weekday-label {
        font-weight: normal;
        text-transform: capitalize;
      }
      .games-count {
        font-weight: 600;
        margin: 0.75rem 0 0.35rem;
      }
      .incomplete {
        background: #fff3cd;
      }
      p-message {
        display: block;
        margin: 8px 0;
      }
    `,
  ],
})
export class TournamentFitImportComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tournamentService = inject(TournamentService);
  private readonly fitService = inject(FitImportService);
  readonly competitions = signal<FitCompetition[]>([]);
  readonly seasons = signal<FitReference[]>([]);
  readonly data = signal<FITData | null>(null);
  readonly busy = signal(false);
  readonly seasonsLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly timeZones = ['UTC', ...Intl.supportedValuesOf('timeZone')]
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort();
  tournament: Tournament | null = null;
  competitionSlug = '';
  season = '';
  targetTimeZone = 'UTC';
  capitalizeTeamName = false;
  divisionRows: RenameRow[] = [];
  teamRows: RenameRow[] = [];
  fieldRows: Array<{ fitName: string; automatic: string; appName: string }> =
    [];

  renamingTree: TreeNode<RenameRow>[] = [];

  private rebuildRenamingTree(): void {
    this.renamingTree = this.divisionRows.map((division) => ({
      data: division,
      children: this.teamRows
        .filter((team) => team.division === division.fitName)
        .map((team) => ({ data: team })),
    }));
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('tournamentId');
    if (!id) {
      this.router.navigate(['/app/welcome']);
      return;
    }
    this.tournamentService.byId(id).subscribe({
      next: (tournament) => {
        if (!tournament) {
          this.router.navigate(['/tournament']);
          return;
        }
        this.tournament = tournament;
        this.competitionSlug = tournament.fit?.competitionSlug ?? '';
        this.season = tournament.fit?.season ?? '';
        this.targetTimeZone =
          tournament.fit?.targetTimeZone ?? tournament.timeZone ?? 'UTC';
        this.capitalizeTeamName =
          tournament.fit?.renaming.capitalizeTeamName ?? false;
        this.fitService.competitions().subscribe({
          next: (values) => this.competitions.set(values),
          error: (error) => this.error.set(error.message),
        });
        if (this.competitionSlug) this.loadSeasons(this.season);
      },
      error: (error) => this.error.set(error.message),
    });
  }

  competitionChanged(): void {
    this.season = '';
    this.seasons.set([]);
    this.loadSeasons();
  }

  private loadSeasons(selectedSeason = ''): void {
    this.seasonsLoading.set(true);
    if (!this.competitionSlug) {
      this.seasonsLoading.set(false);
      return;
    }
    this.fitService.seasons(this.competitionSlug).subscribe({
      next: (values) => {
        this.seasons.set(values);
        this.season = values.some((value) => value.slug === selectedSeason)
          ? selectedSeason
          : '';
        this.seasonsLoading.set(false);
      },
      error: (error) => {
        this.error.set(error.message);
        this.seasonsLoading.set(false);
      },
    });
  }

  download(): void {
    if (!this.tournament || !this.competitionSlug || !this.season) return;
    this.busy.set(true);
    this.error.set(null);
    const config = this.configFromRows();
    this.fitService
      .load(
        this.competitionSlug,
        this.season,
        this.tournament,
        config,
        this.targetTimeZone,
      )
      .subscribe({
        next: (value) => {
          this.compare(value, this.data());
          this.data.set(value);
          this.prepareRows(value, config);
          this.tournament!.fit = {
            competitionSlug: this.competitionSlug,
            season: this.season,
            targetTimeZone: this.targetTimeZone,
            renaming: config,
            lastImportDate: value.importDate,
          };
          this.tournamentService
            .save(this.tournament!)
            .subscribe({ error: (error) => this.error.set(error.message) });
          this.busy.set(false);
        },
        error: (error) => {
          this.error.set(error.message);
          this.busy.set(false);
        },
      });
  }

  isUnassigned = (game: FitGame): boolean => !game.date;
  gamesForDay(games: FitGame[], date: string): FitGame[] {
    return games
      .filter((game) => game.date === date)
      .sort(
        (left, right) =>
          left.timeslot.localeCompare(right.timeslot) ||
          left.field.localeCompare(right.field) ||
          left.gameId - right.gameId,
      );
  }
  unassignedGames(games: FitGame[]): FitGame[] {
    return games.filter(this.isUnassigned);
  }
  renamedDivision(name: string): string {
    return (
      this.divisionRows.find((row) => row.fitName === name)?.appName ||
      this.divisionRows.find((row) => row.fitName === name)?.automatic ||
      name
    );
  }
  renamedTeam(name: string): string {
    return (
      this.teamRows.find((row) => row.fitName === name)?.appName ||
      this.teamRows.find((row) => row.fitName === name)?.automatic ||
      name
    );
  }

  timeslotRows(days: FITData['days']): Array<{ index: number }> {
    const maxLength = Math.max(0, ...days.map((day) => day.timeslots.length));
    return Array.from({ length: maxLength }, (_, index) => ({ index }));
  }

  weekdayName(date: string): string {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      weekday: 'long',
    }).format(new Date(`${date}T12:00:00Z`));
  }

  private prepareRows(value: FITData, config: FitRenamingConfig): void {
    this.divisionRows = value.divisions.map((item) => ({
      fitName: item.name,
      automatic: toCategory(item.name),
      kind: 'division' as const,
      appName:
        config.divisions.find((rename) => rename.fitName === item.name)
          ?.appName ?? '',
    }));
    this.teamRows = value.divisions.flatMap((division) =>
      division.teams.map((team) => ({
        division: division.name,
        fitName: team,
        automatic: team,
        kind: 'team' as const,
        appName:
          config.teams.find((rename) => rename.fitName === team)?.appName ?? '',
      })),
    );
    this.rebuildRenamingTree();
    this.fieldRows = Array.from(
      new Set(
        value.games.map((game) => game.fitField || game.field).filter(Boolean),
      ),
    )
      .map((field) => ({
        fitName: field,
        automatic: field,
        appName:
          config.fields.find((rename) => rename.fitName === field)?.appName ??
          '',
      }))
      .sort((left, right) => left.fitName.localeCompare(right.fitName));
  }

  private configFromRows(): FitRenamingConfig {
    const old = this.tournament?.fit?.renaming;
    return {
      divisions: this.mergeRows(this.divisionRows, old?.divisions),
      teams: this.mergeRows(this.teamRows, old?.teams),
      fields: this.mergeRows(this.fieldRows, old?.fields),
      capitalizeTeamName: this.capitalizeTeamName,
    };
  }

  private mergeRows(
    rows: Array<{ fitName: string; appName: string }>,
    old: Array<{ fitName: string; appName: string }> | undefined,
  ): Array<{ fitName: string; appName: string }> {
    return Array.from(
      new Map(
        [...(old ?? []), ...rows].map((item) => [item.fitName, item]),
      ).values(),
    );
  }

  private compare(value: FITData, previous: FITData | null): void {
    if (!previous) return;
    const old = new Map(previous.games.map((game) => [game.gameId, game]));
    for (const game of value.games) {
      const prior = old.get(game.gameId);
      if (!prior) {
        game.status = 'New';
        continue;
      }
      const properties: (keyof FitGame)[] = [
        'timeslot',
        'field',
        'division',
        'gameType',
        'resultRequired',
        'teamHome',
        'teamAway',
      ];
      game.changes = properties
        .filter((property) => game[property] !== prior[property])
        .map(
          (property) =>
            `${property}: ${String(prior[property])} -> ${String(game[property])}`,
        );
      game.status = game.changes.length ? 'Update' : 'Equal';
      old.delete(game.gameId);
    }
    for (const game of old.values())
      value.games.push({
        ...game,
        status: 'Deleted',
        changes: ['missing from new download'],
      });
  }
}
