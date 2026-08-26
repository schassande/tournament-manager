import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, ViewChild, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GameView } from '../allocation-data-model';
import {
  RefereeSelectorActivation,
  RefereeSelectorEntry,
  RefereeSelectorFacade,
  RefereeSelectorFilters,
  RefereeSelectorSortMode,
  badgeStyle,
  effectiveAllocationConfiguration,
  isRefereeEligible,
  matchesSearch,
} from '../service/referee-selector.service';
import { FragmentRefereeAllocation, GeneralAllocationConfiguration, TournamentRefereeAllocation } from '@tournament-manager/persistent-data-model';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { Popover, PopoverModule } from 'primeng/popover';
import { SelectModule } from 'primeng/select';

/** Referee selection popover used by one referee position in the allocation grid. */
@Component({
  selector: 'app-referee-selector',
  imports: [CheckboxModule, CommonModule, FormsModule, InputTextModule, PopoverModule, SelectModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button #anchor type="button" class="referee-cell" 
      [attr.data-referee-position]="position()"
      [class.referee-cell-empty]="!selectedId()"
      [class.referee-cell-selected]="cellSelected()"
      [class.referee-highlight-0]="highlight() === 'referee-highlight-0'"
      [class.referee-highlight-1]="highlight() === 'referee-highlight-1'"
      (click)="activateCell()"
      [attr.aria-label]="selectedId() ? selectedLabel() : 'Select referee'" 
      [attr.aria-expanded]="popover.overlayVisible">
      <span class="referee-cell-label">{{ selectedLabel() }}</span>
      @if (selectedId()) {
        <span class="pi pi-times clear-referee" role="button" tabindex="0" 
        aria-label="Clear referee" (click)="clear($event)"></span>
      }
    </button>

    <p-popover #popover [styleClass]="'referee-selector-popover'" 
      [style]="{ width: '385px' }" [focusOnShow]="false"
      ariaLabel="Select referee" (onShow)="onPopoverShow()">
      <div class="selector-context">{{ contextText() }}</div>
      <div class="selector-form">
        <div class="selector-form-row">
          <input #searchInput pInputText type="text" [ngModel]="search()" 
            (ngModelChange)="updateSearch($event)" aria-label="Search referee"
            [attr.aria-activedescendant]="activeRefereeOptionId()"
            placeholder="Search referee" (keydown)="onSearchKeydown($event)" />
          <p-select [options]="sortOptions" [ngModel]="sortMode()" 
            (ngModelChange)="updateFilter({ sortMode: $event })"
            optionLabel="label" optionValue="value"
            ariaLabel="Sort referees" />
        </div>
        <div class="selector-form-row">
          <p-select [options]="levelOptions" [ngModel]="level()" 
            (ngModelChange)="updateFilter({ level: $event })"
            optionLabel="label" optionValue="value"
            ariaLabel="Referee level" />
          <p-select [options]="categoryOptions" [ngModel]="category()" 
            (ngModelChange)="updateFilter({ category: $event })"
            optionLabel="label" optionValue="value"
            ariaLabel="Referee category" />
          <p-select [options]="genderOptions" [ngModel]="gender()" 
            (ngModelChange)="updateFilter({ gender: $event })"
            optionLabel="label" optionValue="value"
            ariaLabel="Referee gender" />
        </div>
        <div class="selector-form-row selector-checkbox-row">
          <label class="selector-checkbox"><p-checkbox [ngModel]="upgradeOnly()" 
            (ngModelChange)="updateFilter({ upgradeOnly: $event })" [binary]="true" inputId="upgrade-only" />
             Upgrade Only
          </label>
          <label class="selector-checkbox"><p-checkbox [ngModel]="playerRefereesOnly()" 
            (ngModelChange)="updateFilter({ playerRefereesOnly: $event })"
            [binary]="true" inputId="player-referees-only" />
             Player Referee
          </label>
          <label class="selector-checkbox"><p-checkbox [ngModel]="eligibilityEnabled()" 
            (ngModelChange)="updateFilter({ eligibilityEnabled: $event })"
            [binary]="true" inputId="eligibility" />
             Eligibility constraints
          </label>
        </div>
      </div>

      @if (visibleEntries().length === 0) {
        <div class="selector-empty">No eligible referee</div>
      } @else {
        <div #results class="selector-results" role="listbox" aria-label="Eligible referees">
          @for (entry of visibleEntries(); track entry.referee.attendee.id) {
            <div class="referee-card" role="option" tabindex="0"
              [class.referee-card-active]="focusedEntryIndex() === $index"
              [attr.aria-selected]="focusedEntryIndex() === $index"
              [id]="refereeOptionId(entry)" (click)="select(entry)"
              (keydown.enter)="select(entry)" (keydown.space)="select(entry)">
              <div class="card-heading">
                <div class="card-identity">
                  @if (entry.isPlayerReferee) {
                    <strong>{{ entry.referee.team?.name }}</strong>
                  } @else {
                    <strong>{{ entry.referee.attendee.person?.firstName }} {{ entry.referee.attendee.person?.lastName }}</strong>
                    <span class="gender-tag" [class.female]="entry.referee.attendee.person?.gender === 'F'">{{ entry.referee.attendee.person?.gender === 'F' ? 'Female' : 'Male' }}</span>
                  }
                </div>
                @if (!entry.isPlayerReferee) {
                  <span class="badge-tag" [style.background]="badgeStyle(entry).background" [style.color]="badgeStyle(entry).color">
                    L{{ entry.level }}{{ entry.category === 'O' ? '' : entry.category }}{{ entry.upgrade ? '*' : '' }}
                  </span>
                }
              </div>
              <div class="game-list">
                @for (match of entry.games; track match.game.game.id) {
                  <div class="match-line">
                    {{ match.game.timeslotStr }} · {{ match.game.field?.name }} · {{ match.game.division?.shortName }} ·
                    {{ match.game.homeTeam?.shortName ?? '?' }} vs {{ match.game.awayTeam?.shortName ?? '?' }}
                    @if (match.refereeNames.length) { · {{ match.refereeNames.join(', ') }} }
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }
    </p-popover>
  `,
  styles: [`
    :host { display: block; min-width: 200px; }
    .referee-cell { 
      align-items: center; 
      background: transparent; 
      border-top: 1px solid lightgrey; 
      border-right: none; 
      border-left: none; 
      border-bottom: 1px solid lightgrey; 
      display: flex; 
      justify-content: space-between; 
      min-height: 36px; 
      min-width: 200px; 
      padding: 4px 6px; 
      text-align: left; 
      width: 100%; 
    }
    .referee-cell-selected { border-color: transparent; }
    .referee-cell-empty { background: #e3f2fd; }
    .referee-cell.referee-highlight-0 { background-color: #eff542; }
    .referee-cell.referee-highlight-1 { background-color: #42eff5; }
    .referee-cell:focus-visible { 
      outline: 2px solid #1976d2; 
    }
    .referee-cell-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .clear-referee { cursor: pointer; margin-left: 8px; padding: 3px; }
    .selector-context { font-size: .8rem; margin-bottom: 8px; white-space: nowrap; }
    .selector-form { display: grid; gap: 6px; margin-bottom: 8px; }
    .selector-form-row { 
      align-items: center; 
      display: flex; 
      flex-wrap: nowrap; 
      gap: 5px; 
      width: 100%; 
    }
    .selector-form-row p-select { flex: 1 1 0; min-width: 0; width: 0; }
    .selector-form input { flex: 1 1 0; min-width: 0; width: 0; }
    .selector-checkbox-row { justify-content: space-between; }
    .selector-checkbox { 
      align-items: center; 
      display: inline-flex; 
      font-size: .75rem; 
      gap: 3px; 
      white-space: nowrap;
    }
    :host ::ng-deep .referee-selector-popover { max-width: calc(100vw - 16px); min-width: 385px; width: 385px !important; }
    .selector-results { 
      display: grid; 
      gap: 2px; 
      max-height: 280px; 
      min-width: min(385px, calc(100vw - 32px)); 
      overflow: auto; 
    }
    .referee-card { border-bottom: 1px solid lightgrey; cursor: pointer; padding: 5px 4px; }
    .referee-card-active { background: #e3f2fd; }
    .referee-card:hover, .referee-card:focus-visible { outline: 2px solid #1976d2; }
    .card-heading { align-items: start; display: flex; justify-content: space-between; }
    .card-identity { align-items: center; display: flex; gap: 3px; }
    .gender-tag, .badge-tag { 
      border-radius: 7px; 
      font-size: .65rem; 
      padding: 3px 5px; 
      min-width: 35px; 
      text-align: center;
    }
    .gender-tag { background: #4d9de0; color: white; }
    .gender-tag.female { background: #e78ac3; }
    .game-list { 
      font-size: .7rem; 
      line-height: 1; 
      margin: 5px 0 0 20px; 
    }
    .match-line { line-height: 1.1; padding: 0; }
    .selector-empty { padding: 20px; text-align: center; }
  `],
})
export class RefereeSelectorComponent implements AfterViewInit {
  readonly game = input.required<GameView>();
  readonly position = input.required<number>();
  readonly cellSelected = input(false);
  readonly highlight = input<string | undefined>();
  readonly selectedId = input<string | undefined>();
  readonly entries = input.required<RefereeSelectorEntry[]>();
  readonly periodGames = input.required<GameView[]>();
  readonly fragmentAllocation = input<FragmentRefereeAllocation>();
  readonly tournamentAllocation = input<TournamentRefereeAllocation>();
  readonly activation = input<RefereeSelectorActivation>();
  readonly selected = output<string>();
  readonly cleared = output<void>();
  readonly cellActivated = output<void>();

  @ViewChild('popover') protected popover!: Popover;
  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('results') private results?: ElementRef<HTMLElement>;
  @ViewChild('anchor') private anchor!: ElementRef<HTMLButtonElement>;

  private readonly refereeSelectorFacade = inject(RefereeSelectorFacade);
  readonly search = signal('');
  readonly level = computed(() => this.refereeSelectorFacade.filters().level);
  readonly category = computed(() => this.refereeSelectorFacade.filters().category);
  readonly gender = computed(() => this.refereeSelectorFacade.filters().gender);
  readonly upgradeOnly = computed(() => this.refereeSelectorFacade.filters().upgradeOnly);
  readonly playerRefereesOnly = computed(() => this.refereeSelectorFacade.filters().playerRefereesOnly);
  readonly eligibilityEnabled = computed(() => this.refereeSelectorFacade.filters().eligibilityEnabled);
  readonly sortMode = computed(() => this.refereeSelectorFacade.filters().sortMode);
  readonly focusedEntryIndex = signal(0);
  private lastActivation = 0;

  readonly sortOptions = [
    { label: '↑ Level', value: 'level-asc' }, 
    { label: '↓ Level', value: 'level-desc' }, 
    { label: '# Games', value: 'games-asc' }];
  readonly levelOptions = [
    { label: 'All', value: 'All' }, 
    ...[1, 2, 3, 4, 5, 6].map((value) => ({ label: `Level ${value}`, value: String(value) }))];
  readonly categoryOptions = [
    { label: 'All', value: 'All' }, 
    { label: 'Junior', value: 'J' }, 
    { label: 'Open', value: 'O' }, 
    { label: 'Senior', value: 'S' }, 
    { label: 'Master', value: 'M' }];
  readonly genderOptions = [
    { label: 'All', value: 'All' }, 
    { label: 'Male', value: 'M' }, 
    { label: 'Female', value: 'F' }];

  private readonly index = computed(() => this.entries());
  readonly visibleEntries = computed(() => {
    const configuration = effectiveAllocationConfiguration(this.fragmentAllocation(), this.tournamentAllocation());
    const result = this.index().filter((entry) =>
      matchesSearch(entry, this.search())
      && (this.level() === 'All' || entry.level === Number(this.level()))
      && (this.category() === 'All' || entry.category === this.category())
      && (this.gender() === 'All' || entry.referee.attendee.person?.gender === this.gender())
      && (!this.upgradeOnly() || entry.upgrade)
      && (!this.playerRefereesOnly() || entry.isPlayerReferee)
      && (!this.eligibilityEnabled() || isRefereeEligible(entry, this.game(), this.periodGames(), configuration))
    );
    return result.sort((left, right) => this.sortMode() === 'games-asc'
      ? left.games.length - right.games.length || left.displayName.localeCompare(right.displayName)
      : (this.sortMode() === 'level-asc' ? left.level - right.level : right.level - left.level) || left.displayName.localeCompare(right.displayName));
  });

  constructor() {
    effect(() => {
      this.visibleEntries();
      this.focusedEntryIndex.set(0);
    });
    effect(() => {
      const activation = this.activation();
      if (!activation || activation.gameId !== this.game().game.id || activation.position !== this.position() || activation.sequence === this.lastActivation) return;
      this.lastActivation = activation.sequence;
      this.open(activation.searchText);
    });
  }

  /** Opens the popover and seeds the search field with the page keyboard input. */
  open(searchText: string): void {
    this.search.set(searchText);
    this.focusedEntryIndex.set(0);
    this.popover.show(new Event('click'), this.anchor.nativeElement);
  }

  /** Selects this grid position before opening its referee popover. */
  activateCell(): void {
    this.cellActivated.emit();
    this.open('');
  }

  /** Emits the selected attendee and closes the popover. */
  select(entry: RefereeSelectorEntry): void {
    this.selected.emit(entry.referee.attendee.id);
    this.popover.hide();
  }

  /** Clears the allocation without opening the popover. */
  clear(event: Event): void {
    event.stopPropagation();
    this.cleared.emit();
  }

  /** Keeps the initial activation key from being handled by the page again. */
  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.popover.hide();
      return;
    }
    const entries = this.visibleEntries();
    if (!entries.length) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      const index = Math.min(this.focusedEntryIndex(), entries.length - 1);
      this.focusedEntryIndex.set(index);
      this.select(entries[index]);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = Math.max(0, Math.min(entries.length - 1, this.focusedEntryIndex() + direction));
    this.focusedEntryIndex.set(nextIndex);
    this.scrollFocusedEntryIntoView();
  }

  /** Resets the active result when the search expression changes. */
  updateSearch(value: string): void {
    this.search.set(value);
    this.focusedEntryIndex.set(0);
  }

  /** Persists a filter change in the page-scoped selector facade. */
  updateFilter(update: Partial<RefereeSelectorFilters>): void {
    this.refereeSelectorFacade.updateFilters(update);
  }

  /** Returns the stable DOM ID used by the active referee option. */
  refereeOptionId(entry: RefereeSelectorEntry): string {
    return `referee-option-${entry.referee.attendee.id}`;
  }

  /** Returns the active option ID exposed to assistive technologies. */
  activeRefereeOptionId(): string | undefined {
    const entry = this.visibleEntries()[this.focusedEntryIndex()];
    return entry ? this.refereeOptionId(entry) : undefined;
  }

  /** Keeps the active referee visible inside the scrollable results list. */
  private scrollFocusedEntryIntoView(): void {
    setTimeout(() => {
      const card = this.results?.nativeElement.querySelectorAll<HTMLElement>('.referee-card')[this.focusedEntryIndex()];
      card?.scrollIntoView({ block: 'nearest' });
    });
  }

  /** Focuses the search field after PrimeNG has rendered the overlay. */
  focusSearch(): void {
    setTimeout(() => this.searchInput?.nativeElement.focus());
  }

  /** Places the popover in the nearest available area without covering its match cell. */
  onPopoverShow(): void {
    this.focusSearch();
    setTimeout(() => this.positionPopover());
  }

  /** Chooses the side with enough viewport space and clamps only as a last resort. */
  private positionPopover(): void {
    const container = this.popover?.container;
    if (!container) return;
    const anchor = this.anchor.nativeElement.getBoundingClientRect();
    const panel = container.getBoundingClientRect();
    const gap = 6;
    const margin = 8;
    const rightSpace = window.innerWidth - anchor.right;
    const leftSpace = anchor.left;
    const belowSpace = window.innerHeight - anchor.bottom;
    const aboveSpace = anchor.top;
    const left = rightSpace >= panel.width + gap
      ? anchor.right + gap
      : leftSpace >= panel.width + gap
        ? anchor.left - panel.width - gap
        : Math.max(margin, Math.min(anchor.left, window.innerWidth - panel.width - margin));
    const top = belowSpace >= panel.height + gap
      ? anchor.bottom + gap
      : aboveSpace >= panel.height + gap
        ? anchor.top - panel.height - gap
        : Math.max(margin, Math.min(anchor.bottom + gap, window.innerHeight - panel.height - margin));
    container.style.left = `${left + window.scrollX}px`;
    container.style.top = `${top + window.scrollY}px`;
  }

  selectedLabel(): string {
    const selected = this.index().find((entry) => entry.referee.attendee.id === this.selectedId());
    if (!selected || selected.isPlayerReferee) return selected?.displayName || '';
    const level = `L${selected.level}${selected.category === 'O' ? '' : selected.category}${selected.upgrade ? '*' : ''}`;
    return `${level} ${selected.displayName}`;
  }

  contextText(): string {
    const game = this.game();
    return `${game.timeslotStr} · Field: ${game.field?.name ?? ''} · ${game.division?.shortName ?? ''} · ${game.game.what} · ${game.homeTeam?.shortName ?? '?'} vs ${game.awayTeam?.shortName ?? '?'}`;
  }

  badgeStyle = badgeStyle;

  ngAfterViewInit(): void {
    // The activation effect may run before the view query is available.
    const activation = this.activation();
    if (activation && activation.sequence !== this.lastActivation && activation.gameId === this.game().game.id && activation.position === this.position()) {
      this.lastActivation = activation.sequence;
      this.open(activation.searchText);
    }
  }
}
