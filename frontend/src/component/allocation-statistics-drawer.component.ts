import { CommonModule } from '@angular/common';
import { Component, computed, effect, HostListener, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DrawerModule } from 'primeng/drawer';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { RadioButtonModule } from 'primeng/radiobutton';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import {
  Game,
  GameAttendeeAllocation,
  FragmentRefereeAllocation,
  FragmentRefereeAllocationStatistics,
  Referee,
  RefereeBadgeColor,
  RefereeBadgeColors,
  Timeslot,
  Tournament,
  TournamentRefereeAllocation,
  TournamentRefereeAllocationStatistics,
  RefereeCoach,
  isReferee,
} from '@tournament-manager/persistent-data-model';
import { GameAttendeeAllocationService } from '../service/game-attendee-allocation.service';
import { GameService } from '../service/game.service';
import { DateService } from '../service/date.service';
import { RefereeAllocationStatisticsApiService } from '../service/referee-allocation-statistics-api.service';
import { FragmentRefereeAllocationStatisticsService } from '../service/fragment-referee-allocation-statistics.service';
import { PlanningGame } from '../service/referee-planning-model';
import { TournamentRefereeAllocationStatisticsService } from '../service/tournament-referee-allocation-statistics.service';
import { UserService } from '../service/user.service';
import { RefereeService } from '../service/referee.service';
import { RefereeTimeslotTableComponent } from './referee-timeslot-table.component';

const KEY_STATISTICS_DRAWER_WIDTH = 'tournament-referee-allocation.statistics-drawer-width';

/** Row projection used by the Coaches table so every displayed value is sortable. */
interface CoachStatisticsRow {
  refereeAttendeeId: string;
  refereeName: string;
  averageLevel: number;
  coachedGames: number;
  [field: string]: string | number;
}

/** Displays and refreshes referee allocation statistics independently from the allocation grid. */
@Component({
  selector: 'app-allocation-statistics-drawer',
  imports: [
    ButtonModule,
    CheckboxModule,
    CommonModule,
    DrawerModule,
    FormsModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    RadioButtonModule,
    RefereeTimeslotTableComponent,
    SelectModule,
    TableModule,
  ],
  template: `
    <p-drawer
      [visible]="visible()"
      (visibleChange)="visibleChange.emit($event)"
      position="right"
      [style]="drawerStyle()"
    >
      <ng-template #header
        ><span>Allocation statistics</span>
        <div
          class="statistics-resize-handle"
          role="separator"
          tabindex="0"
          aria-label="Resize allocation statistics drawer"
          aria-orientation="vertical"
          [attr.aria-valuenow]="drawerWidthPercent()"
          [attr.aria-valuemin]="minimumDrawerPercent()"
          [attr.aria-valuemax]="maximumDrawerPercent()"
          (pointerdown)="startResize($event)"
          (pointermove)="onResize($event)"
          (pointerup)="stopResize()"
          (pointercancel)="stopResize()"
          (keydown)="resizeWithKeyboard($event)"
        ></div
      ></ng-template>
      <div class="statistics-filters">
        <div class="statistics-search-row">
          <p-iconfield class="statistics-search-field">
            <input
              pInputText
              type="text"
              placeholder="Search referee"
              [ngModel]="search()"
              (ngModelChange)="search.set($event)"
            />
            @if (search()) {
              <button
                type="button"
                class="p-inputicon pi pi-times statistics-search-clear"
                aria-label="Clear referee search"
                (click)="clearSearch()"
              ></button>
            }
          </p-iconfield>
          <div class="statistics-filter-field statistics-scope-field">
            <p-select
              class="statistics-scope-select"
              [options]="scopes()"
              [ngModel]="scope()"
              (ngModelChange)="scope.set($event ?? 'fragment')"
              optionLabel="label"
              optionValue="value"
            />
          </div>
          <p-button
            label="Force refresh"
            icon="pi pi-refresh"
            severity="warn"
            [loading]="refreshing()"
            [disabled]="refreshing()"
            (onClick)="refreshAll()"
          />
        </div>
        <div class="statistics-options-row">
          <div class="statistics-filter-field">
            <p-select
              [options]="levels"
              [ngModel]="level()"
              (ngModelChange)="level.set($event ?? 'All levels')"
              [showClear]="true"
            />
          </div>
          <div class="statistics-filter-field">
            <p-select
              [options]="categories"
              [ngModel]="category()"
              (ngModelChange)="category.set($event ?? 'All')"
              optionLabel="label"
              optionValue="value"
              [showClear]="true"
            />
          </div>
          <div class="statistics-filter-field">
            <p-select
              [options]="genders"
              [ngModel]="gender()"
              (ngModelChange)="gender.set($event ?? 'All')"
              optionLabel="label"
              optionValue="value"
              [showClear]="true"
            />
          </div>
          <label class="statistics-checkbox"
            ><p-checkbox [ngModel]="upgradeOnly()" (ngModelChange)="upgradeOnly.set($event)" [binary]="true" />
            Upgrade</label
          >
          <label class="statistics-checkbox"
            ><p-checkbox [ngModel]="playerOnly()" (ngModelChange)="playerOnly.set($event)" [binary]="true" /> Player
            Referee</label
          >
        </div>
      </div>
      <div class="statistics-tabs">
        @for (tab of tabs; track tab) {
          <button type="button" [class.active]="activeTab() === tab" (click)="activeTab.set(tab)">{{ tab }}</button>
        }
      </div>
      @if (activeTab() === 'TimeSlot') {
        <app-referee-timeslot-table
          [referees]="timeSlotReferees()"
          [timeslots]="timeSlotTimeslots()"
          [games]="timeSlotGames()"
          [scopeLabel]="scopeLabel()"
          [showExports]="false"
          (cellSelected)="gameSelected.emit($event)"
        />
      } @else if (activeTab() === 'General') {
        <p-table class="statistics-table" [value]="generalRows()" sortMode="single"
          ><ng-template #header
            ><tr>
              <th pSortableColumn="refereeName">Referee <p-sortIcon field="refereeName" /></th>
              <th pSortableColumn="games">Games <p-sortIcon field="games" /></th>
              <th pSortableColumn="badField">Bad field <p-sortIcon field="badField" /></th>
              <th pSortableColumn="video">Video <p-sortIcon field="video" /></th>
              @if (scope() === 'fragment') {
                <th pSortableColumn="firstSlot">First slot <p-sortIcon field="firstSlot" /></th>
                <th pSortableColumn="lastSlot">Last slot <p-sortIcon field="lastSlot" /></th>
              }</tr></ng-template
          ><ng-template #body let-row
            ><tr>
              <td>
                <div class="statistics-referee-cell">
                  @if (refereePrefix(row.refereeAttendeeId)) {
                    <span
                      class="statistics-badge statistics-referee-badge"
                      [style.background-color]="badgeStyle(row.refereeAttendeeId).background"
                      [style.color]="badgeStyle(row.refereeAttendeeId).font"
                      >{{ refereePrefix(row.refereeAttendeeId) }}</span
                    >
                  }
                  <span class="statistics-referee-name">{{ row.refereeName }}</span>
                </div>
              </td>
              <td>{{ row.games }}</td>
              <td>{{ row.badField }}</td>
              <td>{{ row.video }}</td>
              @if (scope() === 'fragment') {
                <td [class.statistics-first-slot]="isFirstDaySlot(row.firstTimeSlotIdx)">{{ row.firstSlot }}</td>
                <td [class.statistics-last-slot]="isLastDaySlot(row.lastTimeSlotIdx)">{{ row.lastSlot }}</td>
              }
            </tr></ng-template
          ><ng-template #emptymessage
            ><tr>
              <td [attr.colspan]="scope() === 'fragment' ? 6 : 4">No statistics available</td>
            </tr></ng-template
          ></p-table
        >
      } @else if (activeTab() === 'Games') {
        <div class="statistics-games-sort">
          <span>Sort:</span
          ><p-radiobutton
            name="games-sort"
            value="asc"
            inputId="games-asc"
            [ngModel]="gamesSort()"
            (ngModelChange)="gamesSort.set($event)"
          /><label for="games-asc">Games ascending</label
          ><p-radiobutton
            name="games-sort"
            value="desc"
            inputId="games-desc"
            [ngModel]="gamesSort()"
            (ngModelChange)="gamesSort.set($event)"
          /><label for="games-desc">Games descending</label
          ><p-radiobutton
            name="games-sort"
            value="name"
            inputId="games-name"
            [ngModel]="gamesSort()"
            (ngModelChange)="gamesSort.set($event)"
          /><label for="games-name">Referee name</label>
        </div>
        @for (stat of sortedGames(); track stat.id) {
          <div class="statistics-card">
            <h4>
              @if (refereePrefix(stat.refereeAttendeeId)) {
                <span
                  class="statistics-badge"
                  [style.background-color]="badgeStyle(stat.refereeAttendeeId).background"
                  [style.color]="badgeStyle(stat.refereeAttendeeId).font"
                  >{{ refereePrefix(stat.refereeAttendeeId) }}</span
                >
              }
              {{ refereePrefix(stat.refereeAttendeeId) ? ' ' : '' }}{{ refereeName(stat.refereeAttendeeId) }}
            </h4>
            <div class="statistics-card-summary">{{ stat.gameIds.length }} games{{ divisionSummary(stat) }}</div>
            @for (game of sortedStatGames(stat); track game.gameId) {
              @let details = gameDetails(game);
              <div
                class="statistics-game-row"
                (click)="gameSelected.emit({ gameId: game.gameId, refereeAttendeeId: stat.refereeAttendeeId })"
                (keydown.enter)="gameSelected.emit({ gameId: game.gameId, refereeAttendeeId: stat.refereeAttendeeId })"
                (keydown.space)="gameSelected.emit({ gameId: game.gameId, refereeAttendeeId: stat.refereeAttendeeId })"
                role="button"
                tabindex="0"
              >
                @if (details.day) {
                  {{ details.day }}
                }
                {{ details.time }} · {{ details.field }} · {{ details.division }} · {{ details.home }} -
                {{ details.away }} ·
                @for (referee of details.referees; track referee.id; let last = $last) {
                  @if (referee.prefix) {
                    <span
                      class="statistics-badge"
                      [style.background-color]="badgeStyle(referee.id).background"
                      [style.color]="badgeStyle(referee.id).font"
                      >{{ referee.prefix }}</span
                    >
                  }
                  {{ referee.prefix ? ' ' : '' }}{{ referee.name }}{{ last ? '' : ', ' }}
                }
                @if (details.coaches) {
                  · {{ details.coaches }}
                }
              </div>
            }
          </div>
        }
      } @else if (activeTab() === 'Buddies') {
        <div class="statistics-games-sort statistics-buddies-sort">
          <span>Sort:</span
          ><p-radiobutton
            name="buddies-sort"
            value="asc"
            inputId="buddies-asc"
            [ngModel]="buddiesSort()"
            (ngModelChange)="buddiesSort.set($event)"
          /><label for="buddies-asc">Games ascending</label
          ><p-radiobutton
            name="buddies-sort"
            value="desc"
            inputId="buddies-desc"
            [ngModel]="buddiesSort()"
            (ngModelChange)="buddiesSort.set($event)"
          /><label for="buddies-desc">Games descending</label
          ><p-radiobutton
            name="buddies-sort"
            value="name"
            inputId="buddies-name"
            [ngModel]="buddiesSort()"
            (ngModelChange)="buddiesSort.set($event)"
          /><label for="buddies-name">Referee name</label>
        </div>
        @for (stat of sortedBuddies(); track stat.id) {
          <div class="statistics-card">
            <h4>
              @if (refereePrefix(stat.refereeAttendeeId)) {
                <span
                  class="statistics-badge"
                  [style.background-color]="badgeStyle(stat.refereeAttendeeId).background"
                  [style.color]="badgeStyle(stat.refereeAttendeeId).font"
                  >{{ refereePrefix(stat.refereeAttendeeId) }}</span
                >
              }
              {{ refereePrefix(stat.refereeAttendeeId) ? ' ' : '' }}{{ refereeName(stat.refereeAttendeeId) }}
            </h4>
            <div class="statistics-card-content">
              <div class="statistics-card-summary">
                {{ stat.buddies.length }} buddies · Average buddy level: {{ stat.buddiesBadgeAvg | number: '1.0-2' }}
              </div>
              @for (buddy of sortedBuddiesFor(stat); track buddy.buddyAttendeeId) {
                <div>
                  @if (refereePrefix(buddy.buddyAttendeeId)) {
                    <span
                      class="statistics-badge"
                      [style.background-color]="badgeStyle(buddy.buddyAttendeeId).background"
                      [style.color]="badgeStyle(buddy.buddyAttendeeId).font"
                      >{{ refereePrefix(buddy.buddyAttendeeId) }}</span
                    >
                  }
                  {{ refereePrefix(buddy.buddyAttendeeId) ? ' ' : '' }}{{ refereeName(buddy.buddyAttendeeId) }} ·
                  {{ buddy.nbGames }} games
                </div>
              }
            </div>
          </div>
        }
      } @else if (activeTab() === 'BuddiesLegacy') {
        @for (stat of filtered(); track stat.id) {
          <div class="statistics-card">
            <h4>
              @if (refereePrefix(stat.refereeAttendeeId)) {
                <span
                  class="statistics-badge"
                  [style.background-color]="badgeStyle(stat.refereeAttendeeId).background"
                  [style.color]="badgeStyle(stat.refereeAttendeeId).font"
                  >{{ refereePrefix(stat.refereeAttendeeId) }}</span
                >
              }
              {{ refereePrefix(stat.refereeAttendeeId) ? ' ' : '' }}{{ refereeName(stat.refereeAttendeeId) }} (average
              badge {{ stat.buddiesBadgeAvg | number: '1.0-2' }})
            </h4>
            @for (buddy of stat.buddies; track buddy.buddyAttendeeId) {
              <div>
                @if (refereePrefix(buddy.buddyAttendeeId)) {
                  <span
                    class="statistics-badge"
                    [style.background-color]="badgeStyle(buddy.buddyAttendeeId).background"
                    [style.color]="badgeStyle(buddy.buddyAttendeeId).font"
                    >{{ refereePrefix(buddy.buddyAttendeeId) }}</span
                  >
                }
                {{ refereePrefix(buddy.buddyAttendeeId) ? ' ' : '' }}{{ refereeName(buddy.buddyAttendeeId) }} ·
                {{ buddy.nbGames }} games
              </div>
            }
          </div>
        }
      } @else if (activeTab() === 'Coaches') {
        <p-table class="statistics-table" [value]="coachRows()" sortMode="single"
          ><ng-template #header
            ><tr>
              <th pSortableColumn="refereeName">Referee <p-sortIcon field="refereeName" /></th>
              <th pSortableColumn="averageLevel">Average level <p-sortIcon field="averageLevel" /></th>
              <th pSortableColumn="coachedGames">Coached games <p-sortIcon field="coachedGames" /></th>
              @for (coachId of coachIds(); track coachId) {
                <th [pSortableColumn]="coachField(coachId)">
                  {{ coachName(coachId) }} <p-sortIcon [field]="coachField(coachId)" />
                </th>
              }</tr></ng-template
          ><ng-template #body let-row
            ><tr>
              <td>
                <div class="statistics-referee-cell">
                  @if (refereePrefix(row.refereeAttendeeId)) {
                    <span
                      class="statistics-badge statistics-referee-badge"
                      [style.background-color]="badgeStyle(row.refereeAttendeeId).background"
                      [style.color]="badgeStyle(row.refereeAttendeeId).font"
                      >{{ refereePrefix(row.refereeAttendeeId) }}</span
                    >
                  }
                  <span class="statistics-referee-name">{{ row.refereeName }}</span>
                </div>
              </td>
              <td>
                @if (row.coachedGames > 0) {
                  {{ row.averageLevel }}
                }
              </td>
              <td>{{ row.coachedGames }}</td>
              @for (coachId of coachIds(); track coachId) {
                <td>{{ row[coachField(coachId)] }}</td>
              }
            </tr></ng-template
          ><ng-template #emptymessage
            ><tr>
              <td [attr.colspan]="3 + coachIds().length">No statistics available</td>
            </tr></ng-template
          ></p-table
        >
      } @else {
        <div class="statistics-team-filter">
          <label for="minimum-games">Minimum game number with a team</label
          ><input
            id="minimum-games"
            pInputText
            type="number"
            min="0"
            [ngModel]="minimumTeamGames()"
            (ngModelChange)="minimumTeamGames.set(+$event || 0)"
          />
        </div>
        <p-table class="statistics-table" [value]="teamRows()" sortMode="single" sortField="games" [sortOrder]="-1"
          ><ng-template #header
            ><tr>
              <th pSortableColumn="refereeName">Referee <p-sortIcon field="refereeName" /></th>
              <th pSortableColumn="division">Division <p-sortIcon field="division" /></th>
              <th pSortableColumn="team">Team <p-sortIcon field="team" /></th>
              <th pSortableColumn="games">Games <p-sortIcon field="games" /></th></tr></ng-template
          ><ng-template #body let-team
            ><tr>
              <td>
                <div class="statistics-referee-cell">
                  @if (refereePrefix(team.refereeId)) {
                    <span
                      class="statistics-badge statistics-referee-badge"
                      [style.background-color]="badgeStyle(team.refereeId).background"
                      [style.color]="badgeStyle(team.refereeId).font"
                      >{{ refereePrefix(team.refereeId) }}</span
                    >
                  }
                  <span class="statistics-referee-name">{{ team.refereeName }}</span>
                </div>
              </td>
              <td>{{ team.division }}</td>
              <td>{{ team.team }}</td>
              <td>{{ team.games }}</td>
            </tr></ng-template
          ><ng-template #emptymessage
            ><tr>
              <td colspan="4">No statistics available</td>
            </tr></ng-template
          ></p-table
        >
      }
    </p-drawer>
  `,
  styles: [
    `
      :host {
        display: contents;
      }
      .statistics-resize-handle {
        background: transparent;
        cursor: col-resize;
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        touch-action: none;
        width: 0.75rem;
        z-index: 10;
      }
      .statistics-resize-handle:hover,
      .statistics-resize-handle:focus-visible {
        background: #bfdbfe;
        outline: 0;
      }
      .statistics-filters {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
        width: 100%;
      }
      .statistics-search-row,
      .statistics-options-row {
        display: flex;
        gap: 0.5rem;
        width: 100%;
      }
      .statistics-search-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto auto;
      }
      .statistics-search-row input {
        min-width: 0;
        width: 100%;
      }
      .statistics-search-field {
        width: 100%;
      }
      .statistics-search-clear {
        border: 0;
        cursor: pointer;
        padding: 0;
      }
      .statistics-scope-field {
        justify-self: end;
      }
      .statistics-scope-select {
        flex: 0 0 200px !important;
        width: 200px !important;
      }
      .statistics-filter-field {
        align-items: center;
        display: flex;
        flex: 1 1 0;
        gap: 0.35rem;
        min-width: 0;
      }
      .statistics-filter-field > span {
        color: #555;
        flex: 0 0 auto;
        font-size: 0.75rem;
      }
      .statistics-filter-field p-select {
        flex: 1 1 auto;
        min-width: 0;
        width: 100%;
      }
      .statistics-checkbox {
        align-items: center;
        display: flex;
        gap: 0.25rem;
        justify-content: center;
        white-space: nowrap;
      }
      .statistics-tabs {
        display: flex;
        gap: 0.25rem;
        border-bottom: 1px solid #ddd;
        margin: 0 0 0.75rem;
      }
      .statistics-tabs button {
        border: 0;
        background: transparent;
        padding: 0.5rem;
        cursor: pointer;
      }
      .statistics-tabs button.active {
        border-bottom: 2px solid #1d4ed8;
        font-weight: 600;
      }
      .statistics-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85rem;
      }
      .statistics-table th,
      .statistics-table td {
        border-bottom: 1px solid #ddd;
        padding: 0.4rem;
        text-align: center;
      }
      .statistics-table th:first-child,
      .statistics-table td:first-child {
        text-align: left;
      }
      .statistics-referee-cell {
        align-items: flex-start;
        display: flex;
        gap: 0.35rem;
        text-align: left;
      }
      .statistics-referee-badge {
        flex: 0 0 auto;
      }
      .statistics-referee-name {
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .statistics-first-slot {
        background-color: #dbeafe;
      }
      .statistics-last-slot {
        background-color: #ffedd5;
      }
      .statistics-card {
        border-bottom: 1px solid #ddd;
        padding: 0.5rem 0;
      }
      .statistics-card h4 {
        margin: 0.25rem 0 0.5rem;
      }
      .statistics-card-content {
        padding-left: 20px;
      }
      .statistics-card-summary {
        margin-bottom: 0.35rem;
      }
      .statistics-badge {
        border-radius: 7px;
        display: inline-block;
        font-size: 0.65rem;
        min-width: 35px;
        padding: 3px 5px;
        text-align: center;
        vertical-align: middle;
      }
      .statistics-games-sort {
        align-items: center;
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem 0.5rem;
        margin-bottom: 0.5rem;
      }
      .statistics-buddies-sort {
        flex-wrap: nowrap;
        overflow-x: auto;
        white-space: nowrap;
      }
      .statistics-game-row {
        cursor: pointer;
        display: block;
        padding: 0.2rem 0 0.2rem 20px;
      }
      .statistics-game-row:hover {
        background-color: #f5f5f5 !important;
      }
      .statistics-game-row:focus-visible {
        background-color: #f5f5f5 !important;
        outline: 2px solid #1976d2;
        outline-offset: 1px;
      }
      .statistics-team-filter {
        align-items: center;
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
        margin-bottom: 0.5rem;
      }
      .statistics-team-filter input {
        width: 5rem;
      }
      @media (max-width: 768px) {
        .statistics-options-row {
          flex-wrap: wrap;
        }
      }
    `,
  ],
})
export class AllocationStatisticsDrawerComponent {
  readonly visible = input.required<boolean>();
  readonly tournament = input.required<Tournament>();
  readonly allocation = input.required<FragmentRefereeAllocation>();
  readonly tournamentAllocation = input.required<TournamentRefereeAllocation>();
  readonly referees = input.required<(Referee | undefined)[]>();
  readonly coaches = input.required<(RefereeCoach | undefined)[]>();
  readonly refreshToken = input(0);
  readonly visibleChange = output<boolean>();
  readonly gameSelected = output<{ gameId: string; refereeAttendeeId: string }>();
  private readonly gameService = inject(GameService);
  private readonly allocationService = inject(GameAttendeeAllocationService);
  private readonly dateService = inject(DateService);
  private readonly api = inject(RefereeAllocationStatisticsApiService);
  private readonly fragmentService = inject(FragmentRefereeAllocationStatisticsService);
  private readonly tournamentService = inject(TournamentRefereeAllocationStatisticsService);
  private readonly userService = inject(UserService);
  private readonly refereeService = inject(RefereeService);
  readonly search = signal('');
  readonly level = signal('All levels');
  readonly category = signal('All');
  readonly gender = signal('All');
  readonly upgradeOnly = signal(false);
  readonly playerOnly = signal(false);
  readonly minimumTeamGames = signal(2);
  readonly scope = signal<'fragment' | 'tournament'>('fragment');
  readonly activeTab = signal('General');
  readonly gamesSort = signal<'asc' | 'desc' | 'name'>('asc');
  readonly buddiesSort = signal<'asc' | 'desc' | 'name'>('asc');
  readonly refreshing = signal(false);
  readonly levels = ['All levels', 'Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5', 'Level 6'];
  readonly categories = [
    { label: 'All categories', value: 'All' },
    { label: 'Junior', value: 'J' },
    { label: 'Open', value: 'O' },
    { label: 'Senior', value: 'S' },
    { label: 'Master', value: 'M' },
  ];
  readonly genders = [
    { label: 'All genders', value: 'All' },
    { label: 'Male', value: 'M' },
    { label: 'Female', value: 'F' },
  ];
  readonly tabs = ['General', 'Games', 'Buddies', 'Coaches', 'Teams', 'TimeSlot'];
  readonly fragmentStatistics = signal<FragmentRefereeAllocationStatistics[]>([]);
  readonly tournamentStatistics = signal<TournamentRefereeAllocationStatistics[]>([]);
  readonly games = signal<Game[]>([]);
  readonly allocations = signal<GameAttendeeAllocation[]>([]);
  readonly tournamentReferees = signal<Referee[]>([]);
  readonly drawerWidth = signal<number | undefined>(undefined);
  readonly drawerStyle = computed(() => ({
    width: `${this.drawerWidth() ?? this.defaultDrawerWidthPixels()}px`,
    'max-width': '100vw',
  }));
  private resizing = false;
  private resizeStartX = 0;
  private resizeStartWidth = 0;
  readonly scopes = computed(() => [
    { label: this.fragmentLabel(), value: 'fragment' },
    { label: 'Tournament', value: 'tournament' },
  ]);
  readonly statistics = computed(() =>
    this.scope() === 'fragment'
      ? this.fragmentStatistics()
      : this.tournamentStatistics().map((item) => ({
          ...item.tournamentStatistics,
          id: item.id,
          refereeAttendeeId: item.refereeAttendeeId,
        })),
  );
  /** Returns the timeslots represented by the selected statistics scope. */
  readonly timeSlotTimeslots = computed(() => {
    if (this.scope() === 'fragment') {
      const day = this.tournament().days.find((item) => item.id === this.allocation().dayId);
      const part = this.allocation().partDayId
        ? day?.parts.find((item) => item.id === this.allocation().partDayId)
        : undefined;
      return part?.timeslots ?? day?.parts.flatMap((item) => item.timeslots) ?? [];
    }
    return this.tournament().days.flatMap((day) => day.parts.flatMap((part) => part.timeslots));
  });
  /** Returns the filtered referee attendees displayed by the TimeSlot tab. */
  readonly timeSlotReferees = computed(() => {
    const referees = [...this.referees(), ...this.tournamentReferees()];
    const selectedIds = new Set(this.filtered().map((stat) => stat.refereeAttendeeId));
    return referees
      .filter((referee): referee is Referee => referee !== undefined && selectedIds.has(referee.attendee.id))
      .map((referee) => referee.attendee)
      .filter((referee, index, all) => all.findIndex((item) => item.id === referee.id) === index)
      .sort((firstReferee, secondReferee) => {
        const firstPerson = firstReferee.person;
        const secondPerson = secondReferee.person;
        return (
          (firstPerson?.firstName ?? '').localeCompare(secondPerson?.firstName ?? '', 'fr', { sensitivity: 'base' }) ||
          (firstPerson?.lastName ?? '').localeCompare(secondPerson?.lastName ?? '', 'fr', { sensitivity: 'base' })
        );
      });
  });
  /** Converts the loaded games and allocations to the planning view model used by the shared table. */
  readonly timeSlotGames = computed<PlanningGame[]>(() => {
    const timeslotIds = new Set(this.timeSlotTimeslots().map((timeslot) => timeslot.id));
    const fragmentIds = new Set(
      this.scope() === 'fragment'
        ? [this.allocation().id]
        : this.tournamentAllocation().fragmentRefereeAllocations.map((fragment) => fragment.id),
    );
    return this.games()
      .filter((game) => timeslotIds.has(game.timeslotId))
      .map((game): PlanningGame | undefined => {
        const field = this.tournament().fields.find((item) => item.id === game.fieldId);
        const timeslot = this.timeSlotTimeslots().find((item) => item.id === game.timeslotId);
        const referees = this.allocations().filter(
          (allocation) =>
            allocation.gameId === game.id &&
            fragmentIds.has(allocation.fragmentRefereeAllocationId ?? '') &&
            isReferee(allocation.attendeeRole),
        );
        return field && timeslot
          ? {
              game,
              field,
              timeslot,
              divisionName: '',
              homeTeamName: '',
              awayTeamName: '',
              referees,
              coaches: [] as GameAttendeeAllocation[],
            }
          : undefined;
      })
      .filter((game): game is PlanningGame => game !== undefined);
  });
  readonly filtered = computed(() => {
    const search = this.search().trim().toLowerCase();
    return this.statistics().filter((stat) => {
      const referee = this.referees().find((item) => item?.attendee.id === stat.refereeAttendeeId);
      const info = referee?.attendee.referee;
      return (
        (this.level() === 'All levels' || `Level ${info?.badge}` === this.level()) &&
        (this.category() === 'All' || info?.category === this.category()) &&
        (this.gender() === 'All' || referee?.attendee.person?.gender === this.gender()) &&
        (!this.upgradeOnly() || (info?.upgrade?.badge ?? 0) > 0) &&
        (!this.playerOnly() || referee?.isPR === true) &&
        (!search || this.refereeName(stat.refereeAttendeeId).toLowerCase().includes(search))
      );
    });
  });
  readonly sortedGames = computed(() =>
    [...this.filtered()].sort((a, b) =>
      this.gamesSort() === 'name'
        ? this.refereeName(a.refereeAttendeeId).localeCompare(this.refereeName(b.refereeAttendeeId))
        : (a.gameIds.length - b.gameIds.length) * (this.gamesSort() === 'asc' ? 1 : -1),
    ),
  );
  readonly sortedBuddies = computed(() =>
    [...this.filtered()].sort((a, b) =>
      this.buddiesSort() === 'name'
        ? this.refereeName(a.refereeAttendeeId).localeCompare(this.refereeName(b.refereeAttendeeId))
        : (this.buddyGameCount(a) - this.buddyGameCount(b)) * (this.buddiesSort() === 'asc' ? 1 : -1),
    ),
  );
  readonly generalRows = computed(() =>
    this.filtered().map((stat) => ({
      ...stat,
      refereeName: this.refereeName(stat.refereeAttendeeId),
      games: stat.gameIds.length,
      badField: stat.nbGamesOnBadField,
      video: stat.nbGamesOnVideo,
      firstSlot: this.timeSlot(stat.firstTimeSlotIdx),
      lastSlot: this.timeSlot(stat.lastTimeSlotIdx),
    })),
  );
  readonly coachRows = computed<CoachStatisticsRow[]>(() =>
    this.filtered().map((stat) => {
      const row: CoachStatisticsRow = {
        refereeAttendeeId: stat.refereeAttendeeId,
        refereeName: this.refereeName(stat.refereeAttendeeId),
        averageLevel: stat.coaching.averageCoachingLevel,
        coachedGames: stat.coaching.nbCoachedGames,
      };
      this.coachIds().forEach((coachId) => (row[this.coachField(coachId)] = this.coachCount(stat, coachId)));
      return row;
    }),
  );
  constructor() {
    this.loadDrawerWidthPreference();
    effect(() => {
      this.refreshToken();
      if (this.visible()) void this.load();
    });
  }
  /** Starts resizing the right-positioned drawer from its left edge. */
  startResize(event: PointerEvent): void {
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.resizing = true;
    this.resizeStartX = event.clientX;
    this.resizeStartWidth = this.drawerWidthPixels();
  }
  /** Updates the drawer width while the pointer is dragged. */
  @HostListener('document:pointermove', ['$event'])
  onResize(event: PointerEvent): void {
    if (!this.resizing) return;
    this.setDrawerWidth(this.resizeStartWidth + this.resizeStartX - event.clientX, false);
  }
  /** Stops an active drawer resize operation. */
  @HostListener('document:pointerup')
  stopResize(): void {
    if (!this.resizing) return;
    this.resizing = false;
    this.persistDrawerWidth();
  }
  /** Resizes the drawer with the keyboard when its separator has focus. */
  resizeWithKeyboard(event: KeyboardEvent): void {
    const current = this.drawerWidthPixels();
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.setDrawerWidth(current + 32);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.setDrawerWidth(current - 32);
    } else if (event.key === 'Home') {
      event.preventDefault();
      this.setDrawerWidth(this.minimumDrawerWidth());
    } else if (event.key === 'End') {
      event.preventDefault();
      this.setDrawerWidth(this.maximumDrawerWidth());
    }
  }
  /** Resets an obsolete preference when the browser becomes too narrow. */
  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.drawerWidth() !== undefined && !this.isDrawerWidthValid(this.drawerWidth()!)) this.resetDrawerWidth();
  }
  /** Returns the current width as a percentage for the separator accessibility value. */
  drawerWidthPercent(): number {
    return Math.round((this.drawerWidthPixels() / window.innerWidth) * 100);
  }
  private drawerWidthPixels(): number {
    return this.drawerWidth() ?? this.defaultDrawerWidthPixels();
  }
  private setDrawerWidth(width: number, persist = true): void {
    this.drawerWidth.set(Math.round(Math.max(this.minimumDrawerWidth(), Math.min(this.maximumDrawerWidth(), width))));
    if (persist) this.persistDrawerWidth();
  }
  private loadDrawerWidthPreference(): void {
    const stored = this.userService.getLocalUserProperty(KEY_STATISTICS_DRAWER_WIDTH);
    if (typeof stored === 'number' && this.isDrawerWidthValid(stored)) this.drawerWidth.set(Math.round(stored));
    else if (stored !== null) this.resetDrawerWidth();
  }
  private resetDrawerWidth(): void {
    this.drawerWidth.set(undefined);
    this.userService.setLocalUserProperty(KEY_STATISTICS_DRAWER_WIDTH, this.defaultDrawerWidthPixels());
  }
  private persistDrawerWidth(): void {
    this.userService.setLocalUserProperty(KEY_STATISTICS_DRAWER_WIDTH, this.drawerWidthPixels());
  }
  private isDrawerWidthValid(width: number): boolean {
    return Number.isFinite(width) && width >= this.minimumDrawerWidth() && width <= this.maximumDrawerWidth();
  }
  private minimumDrawerWidth(): number {
    return Math.min(320, window.innerWidth);
  }
  minimumDrawerPercent(): number {
    return Math.round((this.minimumDrawerWidth() / window.innerWidth) * 100);
  }
  private maximumDrawerWidth(): number {
    return window.innerWidth <= 768 ? window.innerWidth : Math.max(this.minimumDrawerWidth(), window.innerWidth * 0.9);
  }
  maximumDrawerPercent(): number {
    return Math.round((this.maximumDrawerWidth() / window.innerWidth) * 100);
  }
  private defaultDrawerWidthPercent(): number {
    return window.innerWidth <= 768 ? 100 : 40;
  }
  private defaultDrawerWidthPixels(): number {
    return (window.innerWidth * this.defaultDrawerWidthPercent()) / 100;
  }
  /** Loads persisted statistics and the tournament reference data used by the cards. */
  private async load(): Promise<void> {
    const id = this.tournament().id;
    const [fragment, tournament, games, allocations, tournamentReferees] = await Promise.all([
      firstValueFrom(this.fragmentService.byTournament(id)),
      firstValueFrom(this.tournamentService.byTournament(id)),
      firstValueFrom(this.gameService.byTournament(id)),
      firstValueFrom(this.allocationService.byTournament(id)),
      firstValueFrom(this.refereeService.findReferees(this.tournament())),
    ]);
    this.fragmentStatistics.set(fragment.filter((item) => item.fragmentRefereeAllocationId === this.allocation().id));
    this.tournamentStatistics.set(
      tournament.filter((item) => item.tournamentRefereeAllocationId === this.tournamentAllocation().id),
    );
    this.games.set(games);
    this.allocations.set(allocations);
    this.tournamentReferees.set(tournamentReferees);
    console.debug('[AllocationStatistics] Loaded drawer data', {
      tournamentId: id,
      fragmentAllocationId: this.allocation().id,
      fragmentStatistics: fragment.length,
      currentFragmentStatistics: this.fragmentStatistics().length,
      tournamentStatistics: this.tournamentStatistics().length,
      games: games.length,
      allocations: allocations.length,
      tournamentReferees: tournamentReferees.length,
    });
  }
  /** Returns identifiers of referees available for the displayed allocation period. */
  private periodRefereeIds(): string[] {
    return [
      ...new Set(this.referees().filter((referee): referee is Referee => referee !== undefined).map((referee) => referee.attendee.id)),
    ];
  }

  /** Returns identifiers of all referees registered for the tournament. */
  private tournamentRefereeIds(): string[] {
    return [...new Set(this.tournamentReferees().map((referee) => referee.attendee.id))];
  }

  /** Clears the referee search text. */
  clearSearch(): void {
    this.search.set('');
  }

  /** Recomputes all statistics in groups of ten requests. */
  async refreshAll(): Promise<void> {
    if (this.refreshing()) {
      console.debug('[AllocationStatistics] Ignored refresh because one is already running');
      return;
    }
    this.refreshing.set(true);
    try {
      await this.load();
      const fragments =
        this.scope() === 'fragment'
          ? [this.allocation().id]
          : this.tournamentAllocation().fragmentRefereeAllocations.map((item) => item.id);
      const ids = this.scope() === 'fragment' ? this.periodRefereeIds() : this.tournamentRefereeIds();
      const requests = fragments.flatMap((fragmentId) => ids.map((refereeId) => ({ fragmentId, refereeId })));

      console.debug('[AllocationStatistics] Starting manual refresh', {
        scope: this.scope(),
        tournamentAllocationId: this.tournamentAllocation().id,
        fragments,
        refereeIds: ids,
        requestCount: requests.length,
      });

      if (requests.length === 0) {
        console.warn('[AllocationStatistics] No refresh requests generated', {
          scope: this.scope(),
          fragments,
          availableReferees: this.referees().length,
        });
      }

      for (let i = 0; i < requests.length; i += 10) {
        const batch = requests.slice(i, i + 10);
        console.debug('[AllocationStatistics] Sending refresh batch', {
          batchNumber: Math.floor(i / 10) + 1,
          batchSize: batch.length,
          requests: batch,
        });
        const results = await Promise.allSettled(
          batch.map((item) =>
            firstValueFrom(this.api.compute(this.tournamentAllocation().id, item.fragmentId, [item.refereeId])),
          ),
        );
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.error('[AllocationStatistics] Refresh request failed', batch[index], result.reason);
          }
        });
      }
      await this.load();
    } catch (error) {
      console.error('[AllocationStatistics] Manual refresh failed before completion', error);
    } finally {
      this.refreshing.set(false);
    }
  }
  refereeName(id: string): string {
    const person = this.referees().find((item) => item?.attendee.id === id)?.attendee.person;
    return person ? `${person.firstName} ${person.lastName}`.trim() : id;
  }
  /** Returns the referee level label displayed before the referee name. */
  refereePrefix(id: string): string {
    const referee = this.referees().find((item) => item?.attendee.id === id);
    const info = referee?.attendee.referee;
    if (!info) return referee?.isPR ? 'Player Referee' : '';
    return `${info.badge}${info.category === 'O' ? '' : info.category}${(info.upgrade?.badge ?? 0) > 0 ? '*' : ''}`;
  }
  badgeStyle(id: string): RefereeBadgeColor {
    const info = this.referees().find((item) => item?.attendee.id === id)?.attendee.referee;
    return (
      RefereeBadgeColors.find((item) => item.badgeSystem === info?.badgeSystem && item.badge === info?.badge) ?? {
        background: 'transparent',
        font: 'inherit',
        badgeSystem: 0,
        badge: 0,
      }
    );
  }
  fragmentLabel(): string {
    const day = this.tournament().days.find((item) => item.id === this.allocation().dayId);
    return this.allocation().partDayId
      ? (day?.parts.find((item) => item.id === this.allocation().partDayId)?.name ?? this.allocation().partDayId ?? '')
      : `Day ${this.allocation().dayId}`;
  }
  /** Returns the label used by the shared timeslot table export. */
  scopeLabel(): string {
    return this.scope() === 'fragment' ? this.fragmentLabel() : 'Tournament';
  }
  divisionName(id: string): string {
    return this.tournament().divisions.find((item) => item.id === id)?.name ?? id;
  }
  teamName(division: string, id: string): string {
    return (
      this.tournament()
        .divisions.find((item) => item.id === division)
        ?.teams.find((item) => item.id === id)?.name ?? id
    );
  }
  timeSlot(index: number): string {
    const slots =
      this.tournament()
        .days.find((item) => item.id === this.allocation().dayId)
        ?.parts.flatMap((item) => item.timeslots) ?? [];
    return slots[index] ? this.dateService.toTime(slots[index].start) : '-';
  }
  /** Returns whether an index points to the first timeslot of the allocation day. */
  isFirstDaySlot(index: number): boolean {
    return index === 0;
  }
  /** Returns whether an index points to the last timeslot of the allocation day. */
  isLastDaySlot(index: number): boolean {
    const slots =
      this.tournament()
        .days.find((item) => item.id === this.allocation().dayId)
        ?.parts.flatMap((item) => item.timeslots) ?? [];
    return slots.length > 0 && index === slots.length - 1;
  }
  coachName(id: string): string {
    const person = this.coaches().find((item) => item?.attendee.id === id)?.attendee.person;
    return person ? `${person.firstName} ${person.lastName}`.trim() : id;
  }
  /** Returns the stable row field used for a dynamic coach column. */
  coachField(id: string): string {
    return `coach_${id}`;
  }
  coachIds(): string[] {
    return [
      ...new Set(this.statistics().flatMap((item) => item.games.flatMap((game) => game.refereeCoachAttendeeIds))),
    ];
  }
  coachCount(stat: { games: { refereeCoachAttendeeIds: string[] }[] }, id: string): number {
    return stat.games.filter((game) => game.refereeCoachAttendeeIds.includes(id)).length;
  }
  teamRows(): { id: string; refereeId: string; refereeName: string; division: string; team: string; games: number }[] {
    return this.filtered().flatMap((stat) =>
      stat.teams
        .filter((item) => item.nbGames >= this.minimumTeamGames())
        .map((item) => ({
          id: `${stat.refereeAttendeeId}:${item.teamId}`,
          refereeId: stat.refereeAttendeeId,
          refereeName: this.refereeName(stat.refereeAttendeeId),
          division: this.divisionName(item.divisionId),
          team: this.teamName(item.divisionId, item.teamId),
          games: item.nbGames,
        })),
    );
  }
  divisionSummary(stat: { games: { divisionId: string }[] }): string {
    const counts = new Map<string, number>();
    stat.games.forEach((game) => counts.set(game.divisionId, (counts.get(game.divisionId) ?? 0) + 1));
    return [...counts].map(([id, count]) => `, ${this.divisionName(id)}: ${count}`).join('');
  }
  /** Returns buddies sorted alphabetically by their resolved referee name. */
  sortedBuddiesFor(stat: { buddies: { buddyAttendeeId: string; nbGames: number }[] }): typeof stat.buddies {
    return [...stat.buddies].sort((left, right) =>
      this.refereeName(left.buddyAttendeeId).localeCompare(this.refereeName(right.buddyAttendeeId)),
    );
  }
  /** Returns the total number of games refereed with buddies for a statistic. */
  buddyGameCount(stat: { buddies: { nbGames: number }[] }): number {
    return stat.buddies.reduce((total, buddy) => total + buddy.nbGames, 0);
  }
  /** Sorts games chronologically by tournament day, timeslot start, then field. */
  sortedStatGames(stat: {
    games: { gameId: string; divisionId: string; timeSlotId: string; refereeCoachAttendeeIds: string[] }[];
  }): typeof stat.games {
    return [...stat.games].sort((a, b) => {
      const left = this.gameSortKey(a.gameId, a.timeSlotId);
      const right = this.gameSortKey(b.gameId, b.timeSlotId);
      return (
        left.dayIndex - right.dayIndex ||
        left.slotStart - right.slotStart ||
        left.field.localeCompare(right.field, undefined, { numeric: true })
      );
    });
  }
  /** Builds the chronological sort key for a game using tournament data rather than IDs. */
  private gameSortKey(gameId: string, timeSlotId: string): { dayIndex: number; slotStart: number; field: string } {
    const game = this.game(gameId);
    const dayIndex = this.tournament().days.findIndex((day) => day.id === game?.dayId);
    const day = dayIndex >= 0 ? this.tournament().days[dayIndex] : undefined;
    const slot = day?.parts
      .flatMap((part) => part.timeslots)
      .find((timeslot) => timeslot.id === (game?.timeslotId ?? timeSlotId));
    return {
      dayIndex: dayIndex >= 0 ? dayIndex : Number.MAX_SAFE_INTEGER,
      slotStart: slot?.start ?? Number.MAX_SAFE_INTEGER,
      field: game?.fieldId ?? '',
    };
  }
  private game(id: string): Game | undefined {
    return this.games().find((item) => item.id === id);
  }
  gameDetails(item: { gameId: string; divisionId: string; timeSlotId: string; refereeCoachAttendeeIds: string[] }): {
    day: string;
    time: string;
    field: string;
    division: string;
    home: string;
    away: string;
    referees: { id: string; name: string; prefix: string }[];
    coaches: string;
  } {
    const game = this.game(item.gameId);
    const day = this.tournament().days.find((value) => value.id === game?.dayId);
    const slot = day?.parts
      .flatMap((value) => value.timeslots)
      .find((value) => value.id === (game?.timeslotId ?? item.timeSlotId));
    const assigned = this.allocations().filter((value) => value.gameId === item.gameId);
    return {
      day: this.scope() === 'tournament' && game ? `Day ${game.dayId}` : '',
      time: slot ? this.dateService.toTime(slot.start) : '-',
      field: this.tournament().fields.find((value) => value.id === game?.fieldId)?.name ?? '-',
      division: this.divisionName(game?.divisionId ?? item.divisionId),
      home: game ? this.teamName(game.divisionId, game.homeTeamId) : '-',
      away: game ? this.teamName(game.divisionId, game.awayTeamId) : '-',
      referees: assigned
        .filter((value) => isReferee(value.attendeeRole))
        .map((value) => ({
          id: value.attendeeId,
          name: this.refereeName(value.attendeeId),
          prefix: this.refereePrefix(value.attendeeId),
        })),
      coaches: assigned
        .filter((value) => value.attendeeRole === 'Coach' || value.attendeeRole === 'CoachReferee')
        .map((value) => this.coachName(value.attendeeId))
        .join(', '),
    };
  }
}
