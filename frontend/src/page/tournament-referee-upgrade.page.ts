import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Attendee,
  Gender,
  Person,
  RefereeBadgeColor,
  RefereeBadgeColors,
  RefereeCategory,
  RefereeUpgradeCoachVote,
  RefereeUpgradePanelVote,
  UpgradeVote,
} from '@tournament-manager/persistent-data-model';
import { forkJoin, map, Observable, of, switchMap, take } from 'rxjs';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { TextareaModule } from 'primeng/textarea';
import { AbstractTournamentPage } from '../component/tournament-abstract.page';
import { AttendeeService } from '../service/attendee.service';
import { PersonService } from '../service/person.service';
import { RefereeUpgradeCoachVoteService } from '../service/referee-upgrade-coach-vote.service';
import { RefereeUpgradePanelVoteService } from '../service/referee-upgrade-panel-vote.service';
import { UserService } from '../service/user.service';

interface RefereeUpgradeReferee {
  attendee: Attendee;
  person?: Person;
}

interface RefereeUpgradeCoach {
  attendee: Attendee;
  person?: Person;
}

interface CoachVoteRow extends RefereeUpgradeReferee {
  vote: UpgradeVote;
  commentText: string;
}

interface PanelVoteRow extends RefereeUpgradeReferee {
  panelVote: RefereeUpgradePanelVote;
  coachVotes: Map<string, UpgradeVote>;
}

interface FollowUpRow {
  coachShortName: string;
  lastName: string;
  firstName: string;
  badge: number;
  badgeSystem?: number;
  comments?: string[];
}

/** Page used by referee coaches to evaluate and deliberate referee upgrades. */
@Component({
  selector: 'app-tournament-referee-upgrade',
  standalone: true,
  imports: [CommonModule, FormsModule, MultiSelectModule, SelectModule, TableModule, TabsModule, TextareaModule],
  template: `
    @if (tournament() && dataLoaded()) {
      <div class="page">
        @if (referees().length === 0) {
          <p class="empty-state">No referee is currently seeking an upgrade.</p>
        } @else {
        <p-tabs [value]="activeTab()" (valueChange)="activeTab.set($event.toString())">
          <p-tablist>
            <p-tab value="coach">Coach vote</p-tab>
            <p-tab value="panel">Panel Vote</p-tab>
            <p-tab value="upgraded">Upgraded</p-tab>
            <p-tab value="see">To See</p-tab>
            <p-tab value="talk">To talk</p-tab>
          </p-tablist>
          <p-tabpanels>
            <p-tabpanel value="coach">
              <div class="filters">
                <div class="filter-field"><label for="coach-badge-filter">Badge</label><p-select inputId="coach-badge-filter" [options]="badgeOptions" [ngModel]="badgeFilter()" (ngModelChange)="badgeFilter.set($event)" optionLabel="label" optionValue="value" placeholder="Any badge" /></div>
                <div class="filter-field"><label for="coach-category-filter">Category</label><p-select inputId="coach-category-filter" [options]="categoryOptions" [ngModel]="categoryFilter()" (ngModelChange)="categoryFilter.set($event)" optionLabel="label" optionValue="value" placeholder="Any category" /></div>
              </div>
              <p-table [value]="coachRows()" stripedRows showGridlines [scrollable]="true" scrollHeight="60vh" frozenWidth="260px">
                <ng-template #header><tr><th pFrozenColumn>Last name</th><th pFrozenColumn>First name</th><th>Badge</th><th>Category</th><th>Gender</th><th>Vote</th><th>Comment</th></tr></ng-template>
                <ng-template #body let-row>
                  <tr>
                    <td pFrozenColumn [style.background-color]="badgeColor(row).background" [style.color]="badgeColor(row).font">{{ row.person?.lastName }}</td><td pFrozenColumn [style.background-color]="badgeColor(row).background" [style.color]="badgeColor(row).font">{{ row.person?.firstName }}</td>
                    <td [style.background-color]="badgeColor(row).background" [style.color]="badgeColor(row).font"><span class="badge-value">{{ currentBadge(row) }}/{{ row.attendee.referee?.badgeSystem }}</span></td>
                    <td>{{ categoryLabel(row.attendee.referee?.category) }}</td><td>{{ row.person?.gender }}</td>
                    <td class="editable-cell" [style.background-color]="voteColor(row.vote).background" [style.color]="voteColor(row.vote).font"><p-select [options]="voteOptions" [fluid]="true" [styleClass]="voteClass(row.vote)" appendTo="body" [(ngModel)]="row.vote" [disabled]="!canEdit()" (onChange)="saveCoachVote(row)" /></td>
                    <td class="editable-cell"><textarea pInputTextarea rows="2" [(ngModel)]="row.commentText" [disabled]="!canEdit()" (blur)="saveCoachVote(row)"></textarea></td>
                  </tr>
                </ng-template>
              </p-table>
            </p-tabpanel>

            <p-tabpanel value="panel">
              <div class="filters">
                <div class="filter-field"><label for="panel-badge-filter">Badge</label><p-select inputId="panel-badge-filter" [options]="badgeOptions" [ngModel]="badgeFilter()" (ngModelChange)="badgeFilter.set($event)" optionLabel="label" optionValue="value" placeholder="Any badge" /></div>
                <div class="filter-field"><label for="panel-category-filter">Category</label><p-select inputId="panel-category-filter" [options]="categoryOptions" [ngModel]="categoryFilter()" (ngModelChange)="categoryFilter.set($event)" optionLabel="label" optionValue="value" placeholder="Any category" /></div>
              </div>
              <div class="wide-table">
                <p-table [value]="panelRows()" stripedRows showGridlines [scrollable]="true" scrollHeight="60vh" frozenWidth="260px">
                  <ng-template #header><tr><th pFrozenColumn>Last name</th><th pFrozenColumn>First name</th><th>Badge</th><th>Category</th><th>Gender</th><th>Panel Vote</th>@for (coach of coaches(); track coach.attendee.id) {<th>{{ coach.person?.shortName }} ({{ coach.attendee.refereeCoach?.badge }}/{{ coach.attendee.refereeCoach?.badgeSystem }})</th>}<th>Need to See</th><th>Need to talk</th><th>Comment</th></tr></ng-template>
                  <ng-template #body let-row>
                    <tr>
                      <td pFrozenColumn [style.background-color]="badgeColor(row).background" [style.color]="badgeColor(row).font">{{ row.person?.lastName }}</td><td pFrozenColumn [style.background-color]="badgeColor(row).background" [style.color]="badgeColor(row).font">{{ row.person?.firstName }}</td>
                      <td [style.background-color]="badgeColor(row).background" [style.color]="badgeColor(row).font"><span class="badge-value">{{ currentBadge(row) }}/{{ row.attendee.referee?.badgeSystem }}</span></td><td>{{ categoryLabel(row.attendee.referee?.category) }}</td><td>{{ row.person?.gender }}</td>
                      <td class="editable-cell" [style.background-color]="voteColor(row.panelVote.vote).background" [style.color]="voteColor(row.panelVote.vote).font"><p-select [options]="voteOptions" [fluid]="true" [styleClass]="voteClass(row.panelVote.vote)" appendTo="body" [(ngModel)]="row.panelVote.vote" [disabled]="!canEdit()" (onChange)="savePanelVote(row)" /></td>
                      @for (coach of coaches(); track coach.attendee.id) {@let coachVote = row.coachVotes.get(coach.attendee.id) ?? 'Voting'; <td [style.background-color]="voteColor(coachVote).background" [style.color]="voteColor(coachVote).font">{{ coachVote }}</td>}
                      <td class="editable-cell"><p-multiselect [options]="coaches()" [fluid]="true" appendTo="body" optionLabel="person.shortName" optionValue="attendee.id" [(ngModel)]="row.panelVote.needToSee" [disabled]="!canEdit()" (onChange)="savePanelVote(row)" /></td>
                      <td class="editable-cell"><p-select [options]="talkCoachOptions()" [fluid]="true" appendTo="body" optionLabel="label" optionValue="value" [(ngModel)]="row.panelVote.needToTalk" [disabled]="!canEdit() || row.panelVote.vote !== 'Not yet'" (onChange)="savePanelVote(row)" /></td>
                      <td class="comments">@for (line of aggregateComments(row); track $index) {<div>• {{ line }}</div>}</td>
                    </tr>
                  </ng-template>
                </p-table>
              </div>
            </p-tabpanel>

            <p-tabpanel value="upgraded"><div class="filters"><div class="filter-field"><label for="upgraded-badge-filter">Badge</label><p-select inputId="upgraded-badge-filter" [options]="badgeOptions" [ngModel]="badgeFilter()" (ngModelChange)="badgeFilter.set($event)" optionLabel="label" optionValue="value" placeholder="Any badge" /></div><div class="filter-field"><label for="upgraded-category-filter">Category</label><p-select inputId="upgraded-category-filter" [options]="categoryOptions" [ngModel]="categoryFilter()" (ngModelChange)="categoryFilter.set($event)" optionLabel="label" optionValue="value" placeholder="Any category" /></div></div><ng-container *ngTemplateOutlet="summaryTable; context: { rows: upgradedRows() }"></ng-container></p-tabpanel>
            <p-tabpanel value="see"><div class="filters"><div class="filter-field"><label for="see-coach-filter">Coach</label><p-select inputId="see-coach-filter" [options]="coachOptions()" [ngModel]="coachFilter()" (ngModelChange)="coachFilter.set($event)" optionLabel="label" optionValue="value" placeholder="Any coach" /></div></div><ng-container *ngTemplateOutlet="followUpTable; context: { rows: toSeeRows() }"></ng-container></p-tabpanel>
            <p-tabpanel value="talk"><div class="filters"><div class="filter-field"><label for="talk-coach-filter">Coach</label><p-select inputId="talk-coach-filter" [options]="coachOptions()" [ngModel]="coachFilter()" (ngModelChange)="coachFilter.set($event)" optionLabel="label" optionValue="value" placeholder="Any coach" /></div></div><ng-container *ngTemplateOutlet="followUpTable; context: { rows: toTalkRows(), showComments: true }"></ng-container></p-tabpanel>
          </p-tabpanels>
        </p-tabs>
        }
      </div>
    }

    <ng-template #summaryTable let-rows="rows">
      <p-table [value]="rows" stripedRows showGridlines><ng-template #header><tr><th>Last name</th><th>First name</th><th>Badge</th><th>Category</th></tr></ng-template><ng-template #body let-row><tr><td [style.background-color]="badgeColor(row).background" [style.color]="badgeColor(row).font">{{ row.person?.lastName }}</td><td [style.background-color]="badgeColor(row).background" [style.color]="badgeColor(row).font">{{ row.person?.firstName }}</td><td [style.background-color]="badgeColor(row).background" [style.color]="badgeColor(row).font"><span class="badge-value">{{ currentBadge(row) }}/{{ row.attendee.referee?.badgeSystem }}</span></td><td>{{ categoryLabel(row.attendee.referee?.category) }}</td></tr></ng-template></p-table>
    </ng-template>
    <ng-template #followUpTable let-rows="rows" let-showComments="showComments">
        <p-table [value]="rows" stripedRows showGridlines><ng-template #header><tr><th>Coach</th><th>Last name</th><th>First name</th>@if (showComments) {<th>Comments</th>}</tr></ng-template><ng-template #body let-row><tr><td>{{ row.coachShortName }}</td><td [style.background-color]="badgeColorForValues(row.badge, row.badgeSystem).background" [style.color]="badgeColorForValues(row.badge, row.badgeSystem).font">{{ row.lastName }}</td><td [style.background-color]="badgeColorForValues(row.badge, row.badgeSystem).background" [style.color]="badgeColorForValues(row.badge, row.badgeSystem).font">{{ row.firstName }}</td>@if (showComments) {<td class="comments">@for (line of row.comments ?? []; track $index) {<div>• {{ line }}</div>}</td>}</tr></ng-template></p-table>
    </ng-template>
  `,
  styles: [`
    .page { margin: 0 auto; }
    .filters { display: flex; align-items: center; gap: 1rem; flex-wrap: nowrap; margin-bottom: 0.75rem; }
    .filter-field { display: flex; align-items: center; gap: 0.4rem; white-space: nowrap; }
    .filter-field label { font-weight: 600; }
    .badge-value { display: inline-block; min-width: 2.5rem; padding: 0.2rem 0.4rem; border-radius: 0.25rem; text-align: center; }
    .wide-table { max-width: 100%; overflow: hidden; }
    td.editable-cell { padding: 0; }
    td.editable-cell > p-select, td.editable-cell > p-multiselect, td.editable-cell > textarea { display: block; width: 100%; margin: 0; }
    td.editable-cell > textarea { min-width: 18rem; box-sizing: border-box; }
    :host ::ng-deep td.editable-cell > p-select .p-select,
    :host ::ng-deep td.editable-cell > p-multiselect .p-multiselect { width: 100%; min-width: 100%; margin: 0; border: 0; border-radius: 0; }
    :host ::ng-deep td.editable-cell > p-select .p-select-label,
    :host ::ng-deep td.editable-cell > p-multiselect .p-multiselect-label { width: 100%; box-sizing: border-box; }
    .vote-yes, .vote-yes .p-select-label { background: #b7e4c7 !important; color: black !important; }
    .vote-not-yet, .vote-not-yet .p-select-label { background: #f4b6b6 !important; color: black !important; }
    .vote-possible, .vote-possible .p-select-label { background: #b8c7f2 !important; color: black !important; }
    .vote-dns, .vote-dns .p-select-label { background: #e0e0e0 !important; color: black !important; }
    .vote-voting, .vote-voting .p-select-label { background: transparent !important; color: inherit !important; }
    .comments { min-width: 18rem; white-space: normal; }
    th, td { white-space: nowrap; }
    .empty-state { margin: 2rem; text-align: center; }
  `],
})
export class TournamentRefereeUpgradeComponent extends AbstractTournamentPage {
  private readonly attendeeService = inject(AttendeeService);
  private readonly personService = inject(PersonService);
  private readonly userService = inject(UserService);
  private readonly coachVoteService = inject(RefereeUpgradeCoachVoteService);
  private readonly panelVoteService = inject(RefereeUpgradePanelVoteService);

  readonly activeTab = signal('coach');
  readonly referees = signal<RefereeUpgradeReferee[]>([]);
  readonly coaches = signal<RefereeUpgradeCoach[]>([]);
  readonly coachVotes = signal<RefereeUpgradeCoachVote[]>([]);
  readonly panelVotes = signal<RefereeUpgradePanelVote[]>([]);
  readonly currentCoach = signal<Attendee | undefined>(undefined);
  readonly dataLoaded = signal(false);
  badgeFilter = signal<number | null>(null);
  categoryFilter = signal<RefereeCategory | null>(null);
  coachFilter = signal<string | null>(null);

  readonly voteOptions: UpgradeVote[] = ['Yes', 'Possible', 'Not yet', 'DNS', 'Voting'];
  readonly badgeOptions = [{ label: 'All', value: null }, ...[1, 2, 3, 4, 5].map((value) => ({ label: `${value}`, value }))];
  readonly categoryOptions = [
    { label: 'All', value: null },
    { label: 'Junior', value: 'J' as RefereeCategory }, { label: 'Open', value: 'O' as RefereeCategory },
    { label: 'Senior', value: 'S' as RefereeCategory }, { label: 'Master', value: 'M' as RefereeCategory },
  ];

  readonly talkCoachOptions = computed(() => [
    { label: 'Nobody', value: null },
    ...this.coaches().map((coach) => ({ label: coach.person?.shortName ?? '', value: coach.attendee.id })),
  ]);
  readonly coachOptions = computed(() => [
    { label: 'All', value: null },
    ...this.coaches().map((coach) => ({ label: coach.person?.shortName ?? '', value: coach.attendee.id })),
  ]);

  readonly coachRows = computed<CoachVoteRow[]>(() => this.filteredReferees().map((referee) => {
    const coachId = this.currentCoach()?.id;
    const vote = this.coachVotes().find((item) => item.refereeAttendeeId === referee.attendee.id && item.coachAttendeeId === coachId);
    return { ...referee, vote: vote?.vote ?? 'Voting', commentText: (vote?.comments ?? []).join('\n') };
  }));

  readonly panelRows = computed<PanelVoteRow[]>(() => this.filteredReferees().map((referee) => {
    const panelVote = this.panelVotes().find((item) => item.refereeAttendeeId === referee.attendee.id) ?? this.newPanelVote(referee.attendee.id);
    const coachVotes = new Map(this.coaches().map((coach) => [
      coach.attendee.id,
      this.coachVotes().find((vote) => vote.refereeAttendeeId === referee.attendee.id && vote.coachAttendeeId === coach.attendee.id)?.vote ?? 'Voting',
    ]));
    return { ...referee, panelVote: { ...panelVote, needToSee: [...panelVote.needToSee] }, coachVotes };
  }));

  readonly upgradedRows = computed(() => this.filteredReferees().filter((referee) =>
    this.panelVotes().find((vote) => vote.refereeAttendeeId === referee.attendee.id)?.vote === 'Yes'));

  readonly toSeeRows = computed(() => this.followUpRows('see'));
  readonly toTalkRows = computed(() => this.followUpRows('talk'));

  constructor() {
    super();
    effect(() => {
      const tournament = this.tournament();
      if (tournament) this.load(tournament.id);
    });
  }

  /** Whether the connected user is an attendee referee coach in this tournament. */
  canEdit(): boolean {
    return this.currentCoach()?.isRefereeCoach === true;
  }

  /** Return the current badge used by sorting and filtering. */
  currentBadge(row: RefereeUpgradeReferee): number {
    return row.attendee.referee?.badge ?? 0;
  }

  /** Convert the persisted referee category code to its display label. */
  categoryLabel(category: RefereeCategory | undefined): string {
    return ({ J: 'Junior', O: 'Open', S: 'Senior', M: 'Master' } as Record<RefereeCategory, string>)[category ?? 'O'];
  }

  /** Return the display colors associated with an upgrade vote. */
  voteColor(vote: UpgradeVote): { background: string; font: string } {
    return {
      Yes: { background: '#b7e4c7', font: 'black' },
      'Not yet': { background: '#f4b6b6', font: 'black' },
      Possible: { background: '#b8c7f2', font: 'black' },
      DNS: { background: '#e0e0e0', font: 'black' },
      Voting: { background: 'transparent', font: 'inherit' },
    }[vote];
  }

  /** Return the CSS class used to render a vote widget with its vote color. */
  voteClass(vote: UpgradeVote): string {
    return `vote-${vote.toLowerCase().replace(' ', '-')}`;
  }

  /** Return the configured colors for an arbitre's current badge. */
  badgeColor(row: RefereeUpgradeReferee): RefereeBadgeColor {
    return this.badgeColorForValues(this.currentBadge(row), row.attendee.referee?.badgeSystem);
  }

  /** Return the configured colors for a badge value and badge system. */
  badgeColorForValues(badge: number, badgeSystem: number | undefined): RefereeBadgeColor {
    return RefereeBadgeColors.find((color) => color.badgeSystem === badgeSystem && color.badge === badge)
      ?? { badgeSystem: 0, badge: 0, background: 'transparent', font: 'inherit' };
  }

  /** Persist the current coach's vote and split entered line breaks into comment lines. */
  saveCoachVote(row: CoachVoteRow): void {
    const coach = this.currentCoach();
    const tournament = this.tournament();
    if (!coach || !tournament || !this.canEdit()) return;
    const existing = this.coachVotes().find((vote) => vote.refereeAttendeeId === row.attendee.id && vote.coachAttendeeId === coach.id);
    const vote: RefereeUpgradeCoachVote = {
      id: existing?.id ?? '', lastChange: existing?.lastChange ?? 0,
      tournamentId: tournament.id, refereeAttendeeId: row.attendee.id, coachAttendeeId: coach.id,
      vote: row.vote, comments: row.commentText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
    };
    this.coachVoteService.save(vote).subscribe((saved) => this.upsertCoachVote(saved));
  }

  /** Persist the panel decision and enforce the `needToTalk` business rule. */
  savePanelVote(row: PanelVoteRow): void {
    const coach = this.currentCoach();
    if (!coach || !this.canEdit()) return;
    row.panelVote.updatedByCoachAttendeeId = coach.id;
    this.panelVoteService.save(row.panelVote).subscribe((saved) => this.upsertPanelVote(saved));
  }

  /** Aggregate coach comments with the coach short name prefix. */
  aggregateComments(row: PanelVoteRow): string[] {
    return this.coaches().flatMap((coach) => {
      const vote = this.coachVotes().find((item) => item.refereeAttendeeId === row.attendee.id && item.coachAttendeeId === coach.attendee.id);
      return (vote?.comments ?? []).filter(Boolean).map((comment) => `${coach.person?.shortName ?? ''}: ${comment}`);
    });
  }

  private load(tournamentId: string): void {
    this.dataLoaded.set(false);
    const user = this.userService.currentUser$();
    forkJoin({
      referees: this.loadReferees(tournamentId), coaches: this.loadCoaches(tournamentId),
      coachVotes: this.coachVoteService.findByTournament(tournamentId), panelVotes: this.panelVoteService.findByTournament(tournamentId),
      currentCoach: user
        ? this.attendeeService.findByPerson(tournamentId, user.id).pipe(
          take(1),
          map((attendees) => attendees.find((attendee) => attendee.isRefereeCoach)),
        )
        : of(undefined),
    }).subscribe(({ referees, coaches, coachVotes, panelVotes, currentCoach }) => {
      this.referees.set(referees);
      this.coaches.set(coaches);
      this.currentCoach.set(currentCoach);
      this.coachVotes.set(coachVotes);
      this.panelVotes.set(panelVotes);
      this.dataLoaded.set(true);
      this.ensureInitialVotes(tournamentId, referees, coaches, coachVotes, panelVotes);
    });
  }

  /** Create only the connected coach's missing votes and every missing panel decision. */
  private ensureInitialVotes(
    tournamentId: string,
    referees: RefereeUpgradeReferee[],
    coaches: RefereeUpgradeCoach[],
    coachVotes: RefereeUpgradeCoachVote[],
    panelVotes: RefereeUpgradePanelVote[],
  ): void {
    const currentCoach = this.currentCoach();
    const coachVoteSaves = currentCoach
      ? referees
        .filter((referee) => !coachVotes.some((vote) => vote.refereeAttendeeId === referee.attendee.id && vote.coachAttendeeId === currentCoach.id))
        .map((referee) => this.coachVoteService.save({
          id: '', lastChange: 0, tournamentId, refereeAttendeeId: referee.attendee.id,
          coachAttendeeId: currentCoach.id, vote: 'Voting', comments: [],
        }))
      : [];
    const panelVoteSaves = referees
      .filter((referee) => !panelVotes.some((vote) => vote.refereeAttendeeId === referee.attendee.id))
      .map((referee) => this.panelVoteService.save({
        id: '', lastChange: 0, tournamentId, refereeAttendeeId: referee.attendee.id,
        vote: 'Voting', updatedByCoachAttendeeId: currentCoach?.id ?? coaches[0]?.attendee.id ?? '',
        needToSee: [], needToTalk: null,
      }));
    if (coachVoteSaves.length) forkJoin(coachVoteSaves).subscribe((saved) => this.coachVotes.update((votes) => [...votes, ...saved]));
    if (panelVoteSaves.length) forkJoin(panelVoteSaves).subscribe((saved) => this.panelVotes.update((votes) => [...votes, ...saved]));
  }

  private loadReferees(tournamentId: string): Observable<RefereeUpgradeReferee[]> {
    return this.attendeeService.findTournamentReferees(tournamentId).pipe(
      map((attendees) => attendees.filter((attendee) => attendee.referee?.upgrade && attendee.referee.upgrade.badge !== 0)),
      switchMap((attendees) => this.attachPeople(attendees)),
    );
  }

  private loadCoaches(tournamentId: string): Observable<RefereeUpgradeCoach[]> {
    return this.attendeeService.findTournamentRefereeCoaches(tournamentId).pipe(switchMap((attendees) => this.attachPeople(attendees)));
  }

  private attachPeople<T extends Attendee>(attendees: T[]): Observable<Array<{ attendee: T; person?: Person }>> {
    const requests = attendees.map((attendee) => this.personService.byId(attendee.personId).pipe(
      take(1),
      map((person) => ({ attendee, person })),
    ));
    return requests.length ? forkJoin(requests) : of([]);
  }

  private filteredReferees(): RefereeUpgradeReferee[] {
    return [...this.referees()]
      .filter((referee) => this.badgeFilter() === null || this.currentBadge(referee) === this.badgeFilter())
      .filter((referee) => this.categoryFilter() === null || referee.attendee.referee?.category === this.categoryFilter())
      .sort((a, b) => this.compareReferees(a, b));
  }

  private compareReferees(a: RefereeUpgradeReferee, b: RefereeUpgradeReferee): number {
    const badge = this.currentBadge(a) - this.currentBadge(b);
    if (badge) return badge;
    const categories: RefereeCategory[] = ['J', 'O', 'S', 'M'];
    const category = categories.indexOf(a.attendee.referee?.category ?? 'M') - categories.indexOf(b.attendee.referee?.category ?? 'M');
    if (category) return category;
    return `${a.person?.lastName ?? ''} ${a.person?.firstName ?? ''}`.localeCompare(`${b.person?.lastName ?? ''} ${b.person?.firstName ?? ''}`);
  }

  private followUpRows(kind: 'see' | 'talk'): FollowUpRow[] {
    const rows: FollowUpRow[] = [];
    for (const panelVote of this.panelVotes()) {
      const referee = this.referees().find((item) => item.attendee.id === panelVote.refereeAttendeeId);
      if (!referee) continue;
      const coachIds = kind === 'see' ? panelVote.needToSee : panelVote.needToTalk ? [panelVote.needToTalk] : [];
      for (const coachId of coachIds) {
      const coach = this.coaches().find((item) => item.attendee.id === coachId);
        if (coach && (this.coachFilter() === null || coach.attendee.id === this.coachFilter())) rows.push({ coachShortName: coach.person?.shortName ?? '', lastName: referee.person?.lastName ?? '', firstName: referee.person?.firstName ?? '', badge: this.currentBadge(referee), badgeSystem: referee.attendee.referee?.badgeSystem, comments: kind === 'talk' ? this.aggregateCommentsFor(referee.attendee.id) : undefined });
      }
    }
    return rows.sort((a, b) => `${a.coachShortName} ${a.lastName} ${a.firstName}`.localeCompare(`${b.coachShortName} ${b.lastName} ${b.firstName}`));
  }

  private aggregateCommentsFor(refereeAttendeeId: string): string[] {
    return this.coaches().flatMap((coach) => {
      const vote = this.coachVotes().find((item) => item.refereeAttendeeId === refereeAttendeeId && item.coachAttendeeId === coach.attendee.id);
      return (vote?.comments ?? []).filter(Boolean).map((comment) => `${coach.person?.shortName ?? ''}: ${comment}`);
    });
  }

  private newPanelVote(refereeAttendeeId: string): RefereeUpgradePanelVote {
    return { id: '', lastChange: 0, tournamentId: this.tournament()!.id, refereeAttendeeId, vote: 'Voting', updatedByCoachAttendeeId: this.currentCoach()?.id ?? '', needToSee: [], needToTalk: null };
  }

  private upsertCoachVote(vote: RefereeUpgradeCoachVote): void { this.coachVotes.update((votes) => [...votes.filter((item) => item.id !== vote.id), vote]); }
  private upsertPanelVote(vote: RefereeUpgradePanelVote): void { this.panelVotes.update((votes) => [...votes.filter((item) => item.id !== vote.id), vote]); }
}
