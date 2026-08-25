import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TreeNode } from 'primeng/api';
import { TreeTableModule } from 'primeng/treetable';
import { take } from 'rxjs/operators';
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
import { FitDataService } from '../service/fit-data.service';
import { FitMergePlan, FitMergeService } from '../service/fit-merge.service';
import { GameService } from '../service/game.service';
import { FitExcelExportService } from '../service/fit-excel-export.service';

interface RenameRow {
  fitName: string;
  automatic: string;
  appName: string;
  kind: 'division' | 'team';
  division?: string;
}

interface FitDataOption {
  id: string;
  label: string;
}

/** Displays the FIT download and review workflow for the selected tournament. */
@Component({
  standalone: true,
  imports: [
    ButtonModule,
    CommonModule,
    DatePipe,
    DialogModule,
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
      @if (showPage()) {
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
        <label for="fitSnapshot">Previous FIT data</label>
        <p-select
          inputId="fitSnapshot"
          [options]="fitDataOptions()"
          optionLabel="label"
          optionValue="id"
          [(ngModel)]="selectedFitDataId"
          (onChange)="fitDataSelected()"
          [disabled]="busy() || fitDataLoading()"
          placeholder="Select previous FIT data"
        />
      </section>
      <section class="form-row">
        <p-button
          [label]="data() ? 'Refresh' : 'Download'"
          icon="pi pi-download"
          (click)="download()"
          [loading]="busy()"
          [disabled]="busy() || !competitionSlug || !season"
        />
      </section>
      @if (busy()) {
        <p-message severity="info">Downloading FIT data…</p-message>
      }
      @if (lastImportDate(); as lastImportDate) {
        <p-message severity="secondary">
          Last download: {{ lastImportDate | date: 'yyyy-MM-dd HH:mm:ss' }}
        </p-message>
      }
      @if (data(); as fit) {
        <section class="import-actions" aria-label="FIT imports">
          <p-button
            label="Export Excel"
            icon="pi pi-file-excel"
            (click)="exportExcel()"
            [disabled]="busy() || renamingSaving()"
          />
          <p-button
            label="Import structure"
            icon="pi pi-sitemap"
            (click)="previewStructureImport()"
            [disabled]="busy()"
          />
          <p-button
            label="Import all days"
            icon="pi pi-calendar-plus"
            (click)="previewAllDaysImport()"
            [disabled]="busy()"
          />
        </section>
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
              <div class="renaming-actions">
                <p-button
                  label="Save"
                  icon="pi pi-save"
                  (click)="saveRenamingConfiguration()"
                  [loading]="renamingSaving()"
                  [disabled]="busy() || renamingSaving()"
                />
              </div>
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
                  </tr>
                </ng-template>
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
              <div style="height: 30px;"></div>
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
              <div class="renaming-actions">
                <p-button
                  label="Save"
                  icon="pi pi-save"
                  (click)="saveRenamingConfiguration()"
                  [loading]="renamingSaving()"
                  [disabled]="busy() || renamingSaving()"
                />
              </div>
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
                <div class="day-import-action">
                  <p-button
                    label="Import this day"
                    icon="pi pi-calendar-plus"
                    (click)="previewDayImport(day.date)"
                    [disabled]="busy()"
                  />
                </div>
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
      @if (mergePlan(); as plan) {
        <p-dialog
          header="FIT import preview"
          [visible]="mergePreviewVisible"
          (visibleChange)="mergeDialogVisibilityChanged($event)"
          [modal]="true"
          appendTo="body"
          [dismissableMask]="false"
          [style]="{ width: 'min(1100px, 95vw)' }"
          [breakpoints]="{ '960px': '95vw' }"
        >
          <p-message [severity]="plan.errors.length ? 'error' : 'info'">
            {{
              plan.operation === 'structure'
                ? 'Structure import'
                : plan.operation === 'all-days'
                  ? 'All days import'
                  : 'Day import ' + plan.date
            }}: {{ plan.changes.length }} changes,
            {{ plan.warnings.length }} warnings,
            {{ plan.errors.length }} errors.
          </p-message>
          @if (plan.errors.length) {
            <ul class="merge-errors">
              @for (item of plan.errors; track item) {
                <li>{{ item }}</li>
              }
            </ul>
          }
          @if (plan.warnings.length) {
            <ul class="merge-warnings">
              @for (item of plan.warnings; track item) {
                <li>{{ item }}</li>
              }
            </ul>
          }
          <p-table
            [value]="plan.changes"
            size="small"
            showGridlines
            stripedRows
          >
            <ng-template #header>
              <tr>
                <th>Type</th>
                <th>Key</th>
                <th>Action</th>
                <th>Details</th>
              </tr>
            </ng-template>
            <ng-template #body let-change>
              <tr
                [class.merge-warning]="change.warning"
                [class.merge-conflict]="change.action === 'Conflict'"
              >
                <td>{{ change.type }}</td>
                <td>{{ change.key }}</td>
                <td>{{ change.action }}</td>
                <td>{{ change.details }}</td>
              </tr>
            </ng-template>
          </p-table>
          <div class="merge-dialog-actions">
            <p-button
              label="Cancel"
              severity="secondary"
              (click)="closeMergePreview(); $event.stopPropagation()"
            />
            <p-button
              [label]="confirmLabel(plan)"
              icon="pi pi-check"
              (click)="applyMergePlan(); $event.stopPropagation()"
              [disabled]="!!plan.errors.length || busy()"
              [loading]="busy()"
            />
          </div>
        </p-dialog>
      }
      } @else if (competitionsLoading()) {
        <p-message severity="info"
          >Downloading of the FIT competitions ...</p-message
        >
      } @else if (competitionsError()) {
        <p-message severity="error"
          >Could not download the FIT competitions:
          {{ competitionsError() }}</p-message
        >
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
      .renaming-actions {
        display: flex;
        justify-content: flex-start;
        margin: 0.75rem 0;
      }
      .import-actions,
      .day-import-action,
      .merge-dialog-actions {
        display: flex;
        gap: 10px;
        margin: 10px 0;
      }
      .merge-dialog-actions {
        justify-content: flex-end;
        margin-top: 16px;
      }
      .merge-errors {
        color: #b42318;
      }
      .merge-warnings {
        color: #8a5a00;
      }
      .merge-warning {
        background: #fff8e1;
      }
      .merge-conflict {
        background: #fdecec;
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
  private readonly fitDataService = inject(FitDataService);
  private readonly fitMergeService = inject(FitMergeService);
  private readonly gameService = inject(GameService);
  private readonly fitExcelExportService = inject(FitExcelExportService);
  readonly competitions = signal<FitCompetition[]>([]);
  readonly seasons = signal<FitReference[]>([]);
  readonly data = signal<FITData | null>(null);
  readonly fitDataSnapshots = signal<FITData[]>([]);
  readonly latestFitData = signal<FITData | null>(null);
  readonly competitionsLoading = signal(false);
  readonly competitionsLoaded = signal(false);
  readonly competitionsError = signal<string | null>(null);
  readonly showPage = computed(
    () => this.data() !== null || this.competitionsLoaded(),
  );
  readonly fitDataLoading = signal(false);
  readonly busy = signal(false);
  readonly renamingSaving = signal(false);
  readonly seasonsLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly mergePlan = signal<FitMergePlan | null>(null);
  mergePreviewVisible = false;
  readonly timeZones = ['UTC', ...Intl.supportedValuesOf('timeZone')]
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort();
  tournament: Tournament | null = null;
  competitionSlug = '';
  season = '';
  targetTimeZone = 'UTC';
  capitalizeTeamName = false;
  selectedFitDataId = '';
  divisionRows: RenameRow[] = [];
  teamRows: RenameRow[] = [];
  fieldRows: Array<{ fitName: string; automatic: string; appName: string }> =
    [];

  renamingTree: TreeNode<RenameRow>[] = [];

  /** Opens the complete structure import preview. */
  previewStructureImport(): void {
    if (this.busy() || this.mergePlan()) return;
    const snapshot = this.fitForImport();
    if (!this.tournament || !snapshot) return;
    this.busy.set(true);
    this.gameService
      .all()
      .pipe(take(1))
      .subscribe({
        next: (games) => {
          this.mergePlan.set(
            this.fitMergeService.prepareStructure(
              this.tournament!,
              snapshot,
              games.filter((game) => game.tournamentId === this.tournament!.id),
            ),
          );
          this.mergePreviewVisible = true;
          this.busy.set(false);
        },
        error: (error) => {
          this.error.set(error.message);
          this.busy.set(false);
        },
      });
  }

  /** Downloads the currently displayed FIT snapshot with the current renaming edits. */
  exportExcel(): void {
    const snapshot = this.baseFitData();
    if (!snapshot) return;
    const displayed = this.withRenaming(snapshot, this.configFromRows());
    const competition = this.competitions().find(
      (item) => item.slug === displayed.competitionSlug,
    );
    this.fitExcelExportService.download(
      displayed,
      competition?.title ?? displayed.competitionSlug,
    );
  }

  /** Loads current games and opens the selected day import preview. */
  previewDayImport(date: string): void {
    if (this.busy() || this.mergePlan()) return;
    const snapshot = this.fitForImport();
    if (!this.tournament || !snapshot) return;
    this.busy.set(true);
    this.gameService
      .all()
      .pipe(take(1))
      .subscribe({
        next: (games) => {
          this.mergePlan.set(
            this.fitMergeService.prepareDay(
              this.tournament!,
              snapshot,
              date,
              games.filter((game) => game.tournamentId === this.tournament!.id),
            ),
          );
          this.mergePreviewVisible = true;
          this.busy.set(false);
        },
        error: (error) => {
          this.error.set(error.message);
          this.busy.set(false);
        },
      });
  }

  /** Loads current games and opens the preview for importing all FIT days. */
  previewAllDaysImport(): void {
    if (this.busy() || this.mergePlan()) return;
    const snapshot = this.fitForImport();
    if (!this.tournament || !snapshot) return;
    this.busy.set(true);
    this.gameService
      .all()
      .pipe(take(1))
      .subscribe({
        next: (games) => {
          this.mergePlan.set(
            this.fitMergeService.prepareAllDays(
              this.tournament!,
              snapshot,
              games.filter((game) => game.tournamentId === this.tournament!.id),
            ),
          );
          this.mergePreviewVisible = true;
          this.busy.set(false);
        },
        error: (error) => {
          this.error.set(error.message);
          this.busy.set(false);
        },
      });
  }

  /** Applies the currently displayed import plan after preview validation. */
  applyMergePlan(): void {
    const plan = this.mergePlan();
    if (!plan || plan.errors.length || this.busy()) return;
    this.busy.set(true);
    this.closeMergePreview();
    this.fitMergeService.apply(plan).subscribe({
      next: () => {
        this.tournament = plan.tournament;
        this.busy.set(false);
      },
      error: (error) => {
        this.error.set(error.message);
        this.busy.set(false);
      },
    });
  }

  /** Closes the preview without persisting any merge operation. */
  closeMergePreview(): void {
    this.mergePreviewVisible = false;
    this.mergePlan.set(null);
  }

  /** Handles PrimeNG dialog visibility changes without reopening a stale plan. */
  mergeDialogVisibilityChanged(visible: boolean): void {
    if (!visible) this.closeMergePreview();
  }

  /** Returns the confirmation label for the current preview. */
  confirmLabel(plan: FitMergePlan): string {
    return plan.operation === 'structure'
      ? `Confirm structure import (${plan.changes.length} changes)`
      : plan.operation === 'all-days'
        ? `Confirm all days import (${plan.changes.length} changes)`
        : `Confirm day ${plan.date} import (${plan.changes.length} changes)`;
  }

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
    this.tournamentService
      .byId(id)
      .pipe(take(1))
      .subscribe({
        next: (tournament) => {
          if (!tournament) {
            this.router.navigate(['/tournament']);
            return;
          }
          this.tournament = tournament;
          this.applyConfiguration(tournament.fit);
          this.competitionsLoading.set(true);
          this.fitDataLoading.set(true);
          this.fitDataService.forTournament(id).subscribe({
            next: (snapshots) => {
              this.fitDataSnapshots.set(snapshots);
              this.latestFitData.set(snapshots[0] ?? null);
              if (snapshots[0]) {
                this.displayFitData(snapshots[0], tournament.fit?.renaming);
              }
              this.fitDataLoading.set(false);
              this.loadCompetitionsAndSeasons();
            },
            error: (error) => {
              this.error.set(error.message);
              this.fitDataLoading.set(false);
              this.loadCompetitionsAndSeasons();
            },
          });
        },
        error: (error) => this.error.set(error.message),
      });
  }

  /** Returns the selectable labels for persisted FIT snapshots. */
  fitDataOptions(): FitDataOption[] {
    return this.fitDataSnapshots().map((snapshot) => ({
      id: snapshot.id,
      label: `${snapshot.importDate} - ${snapshot.competitionSlug} / ${snapshot.season}`,
    }));
  }

  /** Displays the snapshot selected in the previous FIT data selector. */
  fitDataSelected(): void {
    const selected = this.fitDataSnapshots().find(
      (snapshot) => snapshot.id === this.selectedFitDataId,
    );
    if (selected) this.displayFitData(selected);
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
        this.seasons.set(
          values
            .slice()
            .sort((left, right) => right.title.localeCompare(left.title)),
        );
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

  private loadCompetitionsAndSeasons(): void {
    this.fitService.competitions().subscribe({
      next: (values) => {
        this.competitions.set(
          values
            .slice()
            .sort((left, right) => left.title.localeCompare(right.title)),
        );
        this.competitionsLoaded.set(true);
        this.competitionsLoading.set(false);
      },
      error: (error) => {
        this.competitionsError.set(error.message);
        this.competitionsLoading.set(false);
      },
    });
    if (this.competitionSlug) this.loadSeasons(this.season);
  }

  private applyConfiguration(
    configuration: Tournament['fit'] | FITData | undefined,
  ): void {
    if (!configuration) {
      this.targetTimeZone = this.tournament?.timeZone ?? 'UTC';
      return;
    }
    this.competitionSlug = configuration.competitionSlug;
    this.season = configuration.season;
    this.targetTimeZone = configuration.targetTimeZone;
    this.capitalizeTeamName = configuration.renaming.capitalizeTeamName;
  }

  private displayFitData(
    snapshot: FITData,
    renaming = snapshot.renaming,
  ): void {
    this.selectedFitDataId = snapshot.id;
    this.data.set(snapshot);
    this.tournament!.fit = {
      competitionSlug: snapshot.competitionSlug,
      season: snapshot.season,
      targetTimeZone: snapshot.targetTimeZone,
      renaming,
      lastImportDate: snapshot.importDate,
    };
    this.applyConfiguration(this.tournament!.fit);
    this.prepareRows(snapshot, renaming);
    this.data.set(this.withRenaming(snapshot, renaming));
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
          this.fitDataService.save(value).subscribe({
            next: (saved) => {
              this.fitDataSnapshots.update((snapshots) => [
                saved,
                ...snapshots.filter((snapshot) => snapshot.id !== saved.id),
              ]);
              this.latestFitData.set(saved);
              this.selectedFitDataId = saved.id;
              this.tournamentService.save(this.tournament!).subscribe({
                next: () => this.busy.set(false),
                error: (error) => {
                  this.error.set(error.message);
                  this.busy.set(false);
                },
              });
            },
            error: (error) => {
              this.error.set(error.message);
              this.busy.set(false);
            },
          });
        },
        error: (error) => {
          this.error.set(error.message);
          this.busy.set(false);
        },
      });
  }

  isUnassigned = (game: FitGame): boolean => !game.date;
  lastImportDate(): string | undefined {
    return (
      this.latestFitData()?.importDate ?? this.tournament?.fit?.lastImportDate
    );
  }

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
        fitName: team.name,
        automatic: team.name,
        kind: 'team' as const,
        appName:
          config.teams.find((rename) => rename.fitName === team.name)
            ?.appName ?? '',
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

  /** Persists the current manual naming choices in the tournament configuration. */
  saveRenamingConfiguration(): void {
    if (!this.tournament || !this.data()) return;
    this.renamingSaving.set(true);
    const config = this.configFromRows();
    const source = this.baseFitData();
    if (source) {
      const recalculated = this.withRenaming(source, config);
      this.data.set(recalculated);
      this.prepareRows(source, config);
    }
    const current = this.tournament.fit ?? {
      competitionSlug: this.competitionSlug,
      season: this.season,
      targetTimeZone: this.targetTimeZone,
      renaming: config,
      lastImportDate: this.data()!.importDate,
    };
    this.tournament.fit = {
      ...current,
      renaming: config,
    };
    this.tournamentService.save(this.tournament).subscribe({
      next: () => this.renamingSaving.set(false),
      error: (error) => {
        this.error.set(error.message);
        this.renamingSaving.set(false);
      },
    });
  }

  /** Applies unsaved rename edits to the selected snapshot before planning an import. */
  private fitForImport(): FITData | null {
    const source = this.baseFitData();
    if (!source) return null;
    return this.withRenaming(source, this.configFromRows());
  }

  private baseFitData(): FITData | null {
    return (
      this.fitDataSnapshots().find(
        (snapshot) => snapshot.id === this.selectedFitDataId,
      ) ?? this.data()
    );
  }

  private withRenaming(source: FITData, config: FitRenamingConfig): FITData {
    const value = structuredClone(source);
    const oldConfig = source.renaming;
    const divisionNames = new Map<
      string,
      { oldName: string; newName: string }
    >();
    const teamNames = new Map<string, string>();
    for (const division of value.divisions) {
      const oldName =
        oldConfig.divisions.find((item) => item.fitName === division.name)
          ?.appName || toCategory(division.name);
      const newName =
        config.divisions.find((item) => item.fitName === division.name)
          ?.appName || toCategory(division.name);
      divisionNames.set(oldName, { oldName, newName });
      for (const team of division.teams) {
        // console.log('fitForImport', division.name, team);
        const oldTeam =
          oldConfig.teams.find((item) => item.fitName === team.name)?.appName ||
          team.name;
        const newTeam =
          config.teams.find((item) => item.fitName === team.name)?.appName ||
          team.name;
        teamNames.set(`${oldName}/${oldTeam}`, newTeam);
        team.name = newTeam;
      }
    }
    for (const game of value.games) {
      const oldDivision = divisionNames.get(game.division);
      const oldDivisionName = oldDivision?.oldName ?? game.division;
      game.division = oldDivision?.newName ?? game.division;
      game.teamHome =
        teamNames.get(`${oldDivisionName}/${game.teamHome}`) ?? game.teamHome;
      game.teamAway =
        teamNames.get(`${oldDivisionName}/${game.teamAway}`) ?? game.teamAway;
      if (game.fitField) {
        game.field =
          config.fields.find((item) => item.fitName === game.fitField)
            ?.appName || game.fitField;
      }
    }
    value.renaming = config;
    return value;
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
