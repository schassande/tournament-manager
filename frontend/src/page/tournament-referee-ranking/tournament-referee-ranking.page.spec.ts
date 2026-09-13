import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import {
  Attendee,
  CoachRefereesRanking,
  createTournamentRefereeRanking,
  prepareIndividualRanking,
  Person,
  Tournament,
} from '@tournament-manager/persistent-data-model';
import { AttendeeService } from '../../service/attendee.service';
import { RefereesRankingService } from '../../service/referees-ranking.service';
import { TournamentRefereeRankingService } from '../../service/tournament-referee-ranking.service';
import { TournamentService } from '../../service/tournament.service';
import { UserService } from '../../service/user.service';
import { TournamentRefereeRankingComponent } from './tournament-referee-ranking.page';

describe('tournament ranking page shell', () => {
  const parent = { ...createTournamentRefereeRanking('t', 'coach', 'Finals'), id: 'ranking' };
  const coach = { id: 'coach', tournamentId: 't', isRefereeCoach: true, person: { personId: 'person' } } as Attendee;
  let tournament: Tournament;
  let attendees: jasmine.SpyObj<AttendeeService>;
  let rankings: jasmine.SpyObj<TournamentRefereeRankingService>;
  let individual: jasmine.SpyObj<RefereesRankingService>;
  let queryParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    queryParams = new BehaviorSubject(convertToParamMap({}));
    router = jasmine.createSpyObj('Router', ['navigate']);
    router.navigate.and.returnValue(Promise.resolve(true));
    tournament = { id: 't', name: 'Tournament', enablesModules: ['RANKING'] } as Tournament;
    attendees = jasmine.createSpyObj('AttendeeService', ['findTournamentReferees', 'findTournamentRefereeCoaches']);
    attendees.findTournamentReferees.and.returnValue(
      of([
        { id: 'full', roles: ['Referee'], isReferee: true },
        { id: 'player', roles: ['PlayerReferee'], isReferee: true, player: { teamId: 'team' } },
      ] as Attendee[]),
    );
    attendees.findTournamentRefereeCoaches.and.returnValue(of([coach]));
    rankings = jasmine.createSpyObj('TournamentRefereeRankingService', [
      'findByTournament',
      'createRanking',
      'changeStatus',
      'saveReferees',
      'saveCoaches',
      'removeReferees',
      'repairRanking',
    ]);
    rankings.findByTournament.and.returnValue(of([structuredClone(parent)]));
    individual = jasmine.createSpyObj('RefereesRankingService', ['findByRanking', 'saveIndividual']);
    individual.findByRanking.and.returnValue(of([]));
    TestBed.configureTestingModule({
      imports: [TournamentRefereeRankingComponent],
      providers: [
        provideNoopAnimations(),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ tournamentId: 't' })), queryParamMap: queryParams },
        },
        { provide: Router, useValue: router },
        { provide: UserService, useValue: { currentUser$: signal({ id: 'person' } as Person) } },
        { provide: AttendeeService, useValue: attendees },
        { provide: TournamentRefereeRankingService, useValue: rankings },
        { provide: RefereesRankingService, useValue: individual },
        {
          provide: TournamentService,
          useValue: {
            byId: () => new BehaviorSubject(tournament),
            setCurrentTournament: jasmine.createSpy('setCurrentTournament'),
          },
        },
      ],
    });
  });

  it('restores each tab from the URL and follows URL changes without reloading ranking data', () => {
    queryParams.next(convertToParamMap({ tab: 'me' }));
    const page = TestBed.createComponent(TournamentRefereeRankingComponent).componentInstance;
    expect(page.activeTab()).toBe('me');
    for (const tab of ['referees', 'coaches', 'panel', 'me']) {
      queryParams.next(convertToParamMap({ tab }));
      expect(page.activeTab()).toBe(tab);
    }
    queryParams.next(convertToParamMap({ tab: 'invalid' }));
    expect(page.activeTab()).toBe('referees');
    queryParams.next(convertToParamMap({ tab: 'panel' }));
    queryParams.next(convertToParamMap({}));
    expect(page.activeTab()).toBe('referees');
    expect(rankings.findByTournament).toHaveBeenCalledTimes(1);
    expect(individual.findByRanking).toHaveBeenCalledTimes(1);
  });

  it('writes tab selections to the URL and ignores invalid or unchanged selections', () => {
    const page = TestBed.createComponent(TournamentRefereeRankingComponent).componentInstance;
    page.tabSelected('me');
    expect(router.navigate).toHaveBeenCalledOnceWith([], {
      relativeTo: TestBed.inject(ActivatedRoute),
      queryParams: { tab: 'me' },
      queryParamsHandling: 'merge',
      preserveFragment: true,
    });
    router.navigate.calls.reset();
    for (const tab of ['referees', 'invalid', 1, undefined]) page.tabSelected(tab);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('finishes even for a live tournament stream and loads shared data exactly once', () => {
    const fixture = TestBed.createComponent(TournamentRefereeRankingComponent);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    expect(page.loading()).toBeFalse();
    expect(page.allowed()).toBeTrue();
    expect(page.referees().map((referee) => referee.id)).toEqual(['full']);
    expect(attendees.findTournamentReferees).toHaveBeenCalledOnceWith('t');
    expect(attendees.findTournamentRefereeCoaches).toHaveBeenCalledOnceWith('t');
    expect(rankings.findByTournament).toHaveBeenCalledOnceWith('t');
    expect(individual.findByRanking).toHaveBeenCalledOnceWith('ranking');
    expect(fixture.nativeElement.textContent).toContain('Referees');
    expect(fixture.nativeElement.textContent).toContain('Coaches');
  });

  it('does not read ranking data for a direct URL when the module is disabled', () => {
    tournament.enablesModules = [];
    const page = TestBed.createComponent(TournamentRefereeRankingComponent).componentInstance;
    expect(page.allowed()).toBeFalse();
    expect(rankings.findByTournament).not.toHaveBeenCalled();
  });

  it('does not grant page access to another authenticated person', () => {
    attendees.findTournamentRefereeCoaches.and.returnValue(of([]));
    const page = TestBed.createComponent(TournamentRefereeRankingComponent).componentInstance;
    expect(page.allowed()).toBeFalse();
    expect(rankings.findByTournament).not.toHaveBeenCalled();
  });

  it('selects a newly saved ranking and queries its coach records', () => {
    const page = TestBed.createComponent(TournamentRefereeRankingComponent).componentInstance;
    rankings.createRanking.and.callFake((value) => of({ ...value, id: 'new' }));
    page.openCreate();
    page.newName.setValue('  New finals  ');
    page.createRanking();
    expect(page.selectedRanking()?.name).toBe('New finals');
    expect(page.selectedId()).toBe('new');
    expect(individual.findByRanking).toHaveBeenCalledWith('new');
    expect(page.createDialog()).toBeFalse();
  });

  it('keeps the selection and dialog input when creation fails', () => {
    const page = TestBed.createComponent(TournamentRefereeRankingComponent).componentInstance;
    rankings.createRanking.and.returnValue(throwError(() => new Error('offline')));
    page.openCreate();
    page.newName.setValue('Finals');
    page.createRanking();
    expect(page.selectedId()).toBe('ranking');
    expect(page.createDialog()).toBeTrue();
    expect(page.newName.value).toBe('Finals');
    expect(page.saving()).toBeFalse();
    expect(page.error()).toContain('could not be created');
  });

  it('submits the creation dialog through the actual form without navigating away', () => {
    const fixture = TestBed.createComponent(TournamentRefereeRankingComponent);
    const page = fixture.componentInstance;
    rankings.createRanking.and.callFake((value) => of({ ...value, id: 'submitted' }));
    fixture.detectChanges();
    page.openCreate();
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#ranking-name') as HTMLInputElement;
    input.value = '  Finals from dialog  ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    const form = fixture.nativeElement.querySelector('form.create-form') as HTMLFormElement;
    const event = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(event);
    expect(rankings.createRanking).toHaveBeenCalledTimes(1);
    expect(page.selectedRanking()?.name).toBe('Finals from dialog');
    expect(page.selectedId()).toBe('submitted');
    expect(event.defaultPrevented).toBeTrue();
    expect(page.createDialog()).toBeFalse();
  });

  it('does not update the displayed phase after a failed save', () => {
    const page = TestBed.createComponent(TournamentRefereeRankingComponent).componentInstance;
    rankings.changeStatus.and.returnValue(throwError(() => new Error('denied')));
    page.changeStatus('INDIVIDUAL_RANKING');
    expect(page.selectedRanking()?.status).toBe('CONFIGURE');
    expect(page.saving()).toBeFalse();
  });

  it('discards an obsolete grouped response when the user switches rankings', () => {
    const late = new Subject<CoachRefereesRanking[]>();
    individual.findByRanking.and.callFake((id) => (id === 'ranking' ? late : of([])));
    const page = TestBed.createComponent(TournamentRefereeRankingComponent).componentInstance;
    page.rankings.update((items) => [...items, { ...parent, id: 'second' }]);
    page.rankingSelection.setValue('second');
    late.next([{ id: 'obsolete' } as CoachRefereesRanking]);
    expect(page.selectedId()).toBe('second');
    expect(page.coachRankings()).toEqual([]);
    expect(individual.findByRanking.calls.count()).toBe(2);
  });

  it('confirms panel-phase removal and retains all displayed records if the server fails', () => {
    rankings.findByTournament.and.returnValue(
      of([{ ...parent, status: 'PANEL_RANKING', selectedRefereeAttendeeIds: ['full'] }]),
    );
    rankings.removeReferees.and.returnValue(throwError(() => new Error('transaction failed')));
    const page = TestBed.createComponent(TournamentRefereeRankingComponent).componentInstance;
    page.requestRemoval(['full']);
    expect(rankings.removeReferees).not.toHaveBeenCalled();
    expect(page.pendingRemoval()).toEqual(['full']);
    page.confirmRemoval();
    expect(rankings.removeReferees).toHaveBeenCalledTimes(1);
    expect(page.selectedRanking()?.selectedRefereeAttendeeIds).toEqual(['full']);
    expect(page.error()).toContain('previous configuration is unchanged');
  });

  it('removes without confirmation in CONFIGURE and replaces committed individual records', () => {
    rankings.findByTournament.and.returnValue(of([{ ...parent, selectedRefereeAttendeeIds: ['full'] }]));
    const cleaned = [{ id: 'cleaned', rankedRefereeAttendeeIds: [], locked: true } as unknown as CoachRefereesRanking];
    rankings.removeReferees.and.returnValue(of({ ranking: parent, coachRankings: cleaned, changed: true }));
    const page = TestBed.createComponent(TournamentRefereeRankingComponent).componentInstance;
    page.requestRemoval(['full']);
    expect(rankings.removeReferees).toHaveBeenCalledTimes(1);
    expect(page.pendingRemoval()).toEqual([]);
    expect(page.selectedRanking()?.selectedRefereeAttendeeIds).toEqual([]);
    expect(page.coachRankings()).toEqual(cleaned);
  });

  it('saves coach additions from a non-panel actor without changing individual records or majority', () => {
    const page = TestBed.createComponent(TournamentRefereeRankingComponent).componentInstance;
    const records = [
      {
        id: 'practice',
        locked: true,
        rankingLastChange: 'old',
        rankedRefereeAttendeeIds: ['full'],
      } as CoachRefereesRanking,
    ];
    page.coachRankings.set(records);
    rankings.saveCoaches.and.callFake((value, changes) => of({ ...value, ...changes }));
    page.saveCoaches({ selectedCoachAttendeeIds: ['coach'] });
    expect(rankings.saveCoaches).toHaveBeenCalledOnceWith(parent, { selectedCoachAttendeeIds: ['coach'] }, 'coach');
    expect(page.selectedRanking()?.voteMajority).toBe(1);
    expect(page.coachRankings()).toBe(records);
    page.saveCoaches({ selectedCoachAttendeeIds: [] });
    expect(rankings.saveCoaches).toHaveBeenCalledTimes(2);
    expect(page.pendingCoachChanges()).toBeNull();
  });

  it('confirms coach removal in both active phases, supports cancellation and preserves data on failure', () => {
    const diagnostic = spyOn(console, 'error');
    const page = TestBed.createComponent(TournamentRefereeRankingComponent).componentInstance;
    for (const status of ['INDIVIDUAL_RANKING', 'PANEL_RANKING'] as const) {
      page.rankings.set([{ ...parent, status, selectedCoachAttendeeIds: ['coach'], voteMajority: 5 }]);
      rankings.saveCoaches.calls.reset();
      page.saveCoaches({ selectedCoachAttendeeIds: [] });
      expect(rankings.saveCoaches).not.toHaveBeenCalled();
      page.pendingCoachChanges.set(null);
      expect(page.selectedRanking()?.selectedCoachAttendeeIds).toEqual(['coach']);
      page.saveCoaches({ selectedCoachAttendeeIds: [] });
      rankings.saveCoaches.and.returnValue(throwError(() => new Error('offline')));
      page.confirmCoachRemoval();
      expect(page.selectedRanking()?.selectedCoachAttendeeIds).toEqual(['coach']);
      expect(page.selectedRanking()?.voteMajority).toBe(5);
      expect(page.error()).toContain('Coach changes could not be saved');
      expect(diagnostic).toHaveBeenCalledWith('[Referee ranking] Coach configuration save failed', jasmine.any(Error));
    }
  });

  it('rejects coach edits while CLOSED or loading and clears pending confirmation on ranking switch', () => {
    const page = TestBed.createComponent(TournamentRefereeRankingComponent).componentInstance;
    page.rankings.set([{ ...parent, status: 'CLOSED' }]);
    page.saveCoaches({ voteMajority: 2 });
    page.rankings.set([parent]);
    page.loadingCoaches.set(true);
    page.saveCoaches({ voteMajority: 2 });
    expect(rankings.saveCoaches).not.toHaveBeenCalled();
    page.pendingCoachChanges.set({ selectedCoachAttendeeIds: [] });
    page.rankingSelection.setValue(null);
    expect(page.pendingCoachChanges()).toBeNull();
  });

  it('adds through the real Coach Ranking tab button and displays the committed vote for the chosen coach', () => {
    const current = { ...parent, status: 'INDIVIDUAL_RANKING' as const, selectedRefereeAttendeeIds: ['full'] };
    rankings.findByTournament.and.returnValue(of([current]));
    individual.saveIndividual.and.callFake((ranking, previous, actorId, targetId, changes) =>
      of(prepareIndividualRanking(ranking, previous, actorId, targetId, changes)),
    );
    const fixture = TestBed.createComponent(TournamentRefereeRankingComponent);
    fixture.detectChanges();
    const tabs = Array.from(fixture.nativeElement.querySelectorAll('[role="tab"]')) as HTMLElement[];
    tabs.find((tab) => tab.textContent?.trim() === 'Coach Ranking')!.click();
    fixture.detectChanges();
    const add = fixture.nativeElement.querySelector('app-ranking-me button[aria-label^="Add "]') as HTMLButtonElement;
    expect(add.disabled).toBeFalse();
    add.click();
    fixture.detectChanges();
    expect(individual.saveIndividual).toHaveBeenCalledOnceWith(current, null, 'coach', 'coach', {
      rankedRefereeAttendeeIds: ['full'],
    });
    expect(fixture.componentInstance.selectedCoachRanking()?.rankedRefereeAttendeeIds).toEqual(['full']);
    expect(
      fixture.nativeElement.querySelector('app-ranking-me [aria-label="Coach ranked referees"]').textContent,
    ).toContain('coach ranking (1 / 15)');
    expect(fixture.nativeElement.querySelector('app-ranking-me button[aria-label^="Add "]')).toBeNull();
  });

  it('saves the current owner lazily and updates shared vote/freshness only after the batch succeeds', () => {
    const current = {
      ...parent,
      status: 'PANEL_RANKING' as const,
      selectedRefereeAttendeeIds: ['full'],
      selectedCoachAttendeeIds: ['coach'],
      panelResultState: 'CURRENT' as const,
    };
    rankings.findByTournament.and.returnValue(of([current]));
    const fixture = TestBed.createComponent(TournamentRefereeRankingComponent);
    const page = fixture.componentInstance;
    fixture.detectChanges();
    expect(individual.saveIndividual).not.toHaveBeenCalled();
    const response = new Subject<ReturnType<typeof prepareIndividualRanking>>();
    individual.saveIndividual.and.returnValue(response);
    page.saveIndividual({ locked: true });
    expect(individual.saveIndividual).toHaveBeenCalledOnceWith(current, null, 'coach', 'coach', { locked: true });
    expect(page.selectedCoachRanking()).toBeNull();
    expect(page.selectedRanking()?.panelResultState).toBe('CURRENT');
    response.next(prepareIndividualRanking(current, null, 'coach', 'coach', { locked: true }));
    response.complete();
    expect(page.selectedCoachRanking()?.locked).toBeTrue();
    expect(page.selectedRanking()?.panelResultState).toBe('STALE');
    expect(page.saving()).toBeFalse();
  });

  it('retains individual data on failure and never saves in CONFIGURE or CLOSED', () => {
    spyOn(console, 'error');
    const page = TestBed.createComponent(TournamentRefereeRankingComponent).componentInstance;
    page.saveIndividual({ locked: true });
    page.rankings.set([{ ...parent, status: 'CLOSED', selectedRefereeAttendeeIds: ['full'] }]);
    page.saveIndividual({ locked: true });
    expect(individual.saveIndividual).not.toHaveBeenCalled();
    page.rankings.set([{ ...parent, status: 'INDIVIDUAL_RANKING', selectedRefereeAttendeeIds: ['full'] }]);
    individual.saveIndividual.and.returnValue(throwError(() => new Error('denied')));
    page.saveIndividual({ rankedRefereeAttendeeIds: ['full'] });
    expect(page.selectedCoachRanking()).toBeNull();
    expect(page.error()).toContain('previous order and lock are unchanged');
    expect(page.saving()).toBeFalse();
  });

  it('repairs missing references on load but never repairs a CLOSED snapshot', () => {
    const dangling = { ...parent, selectedRefereeAttendeeIds: ['deleted'] };
    rankings.findByTournament.and.returnValue(of([dangling]));
    rankings.repairRanking.and.returnValue(of({ ranking: parent, coachRankings: [], changed: true }));
    const page = TestBed.createComponent(TournamentRefereeRankingComponent).componentInstance;
    expect(rankings.repairRanking).toHaveBeenCalledTimes(1);
    expect(page.selectedRanking()?.selectedRefereeAttendeeIds).toEqual([]);
    rankings.repairRanking.calls.reset();
    page.rankings.set([{ ...dangling, status: 'CLOSED' }]);
    page.retryCoachRankings();
    expect(rankings.repairRanking).not.toHaveBeenCalled();
    expect(page.selectedRanking()?.selectedRefereeAttendeeIds).toEqual(['deleted']);
  });

  it('selects an accountless coach through PrimeNG and saves that target without changing the actor vote or querying again', async () => {
    const target = {
      id: 'target',
      tournamentId: 't',
      isRefereeCoach: true,
      person: { shortName: 'Target coach' },
    } as Attendee;
    const current = {
      ...parent,
      status: 'PANEL_RANKING' as const,
      selectedCoachAttendeeIds: ['coach', 'target'],
      selectedRefereeAttendeeIds: ['full'],
      panelResultState: 'CURRENT' as const,
    };
    const actorVote = prepareIndividualRanking(current, null, 'coach', 'coach', { locked: false }).individual;
    attendees.findTournamentRefereeCoaches.and.returnValue(of([target, coach]));
    rankings.findByTournament.and.returnValue(of([current]));
    individual.findByRanking.and.returnValue(of([actorVote]));
    individual.saveIndividual.and.callFake((ranking, previous, actorId, targetId, changes) =>
      of(prepareIndividualRanking(ranking, previous, actorId, targetId, changes)),
    );
    queryParams.next(convertToParamMap({ tab: 'me' }));
    const fixture = TestBed.createComponent(TournamentRefereeRankingComponent);
    const page = fixture.componentInstance;
    fixture.detectChanges();
    expect(page.selectedCoach()?.id).toBe('coach');
    (fixture.nativeElement.querySelector('#ranking-coach-select') as HTMLElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    const option = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(
      (item) => item.textContent?.trim() === 'Target coach',
    )!;
    expect(option).toBeDefined();
    option.click();
    fixture.detectChanges();
    expect(page.selectedCoach()?.id).toBe('target');
    expect(page.selectedCoachRanking()).toBeNull();
    expect(individual.saveIndividual).not.toHaveBeenCalled();
    (fixture.nativeElement.querySelector('app-ranking-me button[aria-label^="Add "]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(individual.saveIndividual).toHaveBeenCalledOnceWith(current, null, 'coach', 'target', {
      rankedRefereeAttendeeIds: ['full'],
    });
    expect(page.selectedCoachRanking()?.updatedByCoachAttendeeId).toBe('coach');
    expect(page.coachRankings().find((item) => item.coachAttendeeId === 'coach')).toBe(actorVote);
    expect(fixture.nativeElement.textContent).toContain('Target coach ranking (1 / 15)');
    (fixture.nativeElement.querySelector('#coach-ranking-lock') as HTMLInputElement).click();
    fixture.detectChanges();
    expect(page.selectedRanking()?.panelResultState).toBe('STALE');
    expect(page.selectedRanking()?.updatedByCoachAttendeeId).toBe('coach');
    expect(page.selectedRanking()?.updatedCoachAttendeeId).toBe('target');
    expect(individual.findByRanking).toHaveBeenCalledTimes(1);
  });

  it('keeps target selection during pending or failed saves, and falls back after membership or parent changes', () => {
    spyOn(console, 'error');
    const target = { id: 'target', tournamentId: 't', isRefereeCoach: true } as Attendee;
    const current = {
      ...parent,
      status: 'INDIVIDUAL_RANKING' as const,
      selectedCoachAttendeeIds: ['coach', 'target'],
      selectedRefereeAttendeeIds: ['full'],
    };
    attendees.findTournamentRefereeCoaches.and.returnValue(of([coach, target]));
    rankings.findByTournament.and.returnValue(of([current, { ...current, id: 'second' }]));
    const fixture = TestBed.createComponent(TournamentRefereeRankingComponent);
    const page = fixture.componentInstance;
    fixture.detectChanges();
    page.coachSelection.setValue('target');
    const response = new Subject<ReturnType<typeof prepareIndividualRanking>>();
    individual.saveIndividual.and.returnValue(response);
    page.saveIndividual({ locked: true });
    fixture.detectChanges();
    expect(page.coachSelection.disabled).toBeTrue();
    page.selectCoach('coach');
    expect(page.selectedCoach()?.id).toBe('target');
    response.error(new Error('offline'));
    fixture.detectChanges();
    expect(page.coachSelection.disabled).toBeFalse();
    expect(page.selectedCoachRanking()).toBeNull();
    expect(page.selectedCoach()?.id).toBe('target');
    page.rankings.update((items) => items.map((item) => ({ ...item, selectedCoachAttendeeIds: ['coach'] })));
    fixture.detectChanges();
    expect(page.selectedCoach()?.id).toBe('coach');
    page.rankings.set([current, { ...current, id: 'second' }]);
    fixture.detectChanges();
    expect(page.selectedCoach()?.id).toBe('coach');
    page.selectCoach('target');
    page.rankingSelection.setValue('second');
    fixture.detectChanges();
    expect(page.selectedCoach()?.id).toBe('coach');
    expect(individual.findByRanking).toHaveBeenCalledTimes(2);
  });

  it('allows non-panel own practice but shows selected coaches read-only, excluding invalid target attendees', () => {
    queryParams.next(convertToParamMap({ tab: 'me' }));
    const target = { id: 'target', tournamentId: 't', isRefereeCoach: true } as Attendee;
    const current = {
      ...parent,
      status: 'PANEL_RANKING' as const,
      selectedCoachAttendeeIds: ['target', 'foreign', 'not-coach'],
      selectedRefereeAttendeeIds: ['full'],
    };
    attendees.findTournamentRefereeCoaches.and.returnValue(
      of([
        target,
        coach,
        { ...target, id: 'foreign', tournamentId: 'other' },
        { ...target, id: 'not-coach', isRefereeCoach: false },
      ]),
    );
    rankings.findByTournament.and.returnValue(of([current]));
    individual.saveIndividual.and.callFake((ranking, previous, actorId, targetId, changes) =>
      of(prepareIndividualRanking(ranking, previous, actorId, targetId, changes)),
    );
    const fixture = TestBed.createComponent(TournamentRefereeRankingComponent);
    const page = fixture.componentInstance;
    fixture.detectChanges();
    expect(page.coachOptions().map((item) => item.id)).toEqual(['coach', 'target']);
    expect(page.canEditSelectedCoach()).toBeTrue();
    page.saveIndividual({ locked: true });
    expect(page.selectedCoachRanking()?.locked).toBeTrue();
    page.selectCoach('target');
    fixture.detectChanges();
    expect(page.canEditSelectedCoach()).toBeFalse();
    page.saveIndividual({ locked: true });
    expect(individual.saveIndividual).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('requires both coaches to be selected');
    page.coaches.set([target]);
    fixture.detectChanges();
    expect(page.selectedCoach()?.id).toBe('target');
    page.coaches.set([]);
    fixture.detectChanges();
    expect(page.selectedCoach()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Configure coaches first');
  });
});
