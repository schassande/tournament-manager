import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import {
  Attendee,
  CoachRefereesRanking,
  createTournamentRefereeRanking,
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

  beforeEach(() => {
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
      'removeReferees',
      'repairRanking',
    ]);
    rankings.findByTournament.and.returnValue(of([structuredClone(parent)]));
    individual = jasmine.createSpyObj('RefereesRankingService', ['findByRanking']);
    individual.findByRanking.and.returnValue(of([]));
    TestBed.configureTestingModule({
      imports: [TournamentRefereeRankingComponent],
      providers: [
        provideNoopAnimations(),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ tournamentId: 't' })) } },
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
    expect(page.error()).toContain('previous selection is unchanged');
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
});
