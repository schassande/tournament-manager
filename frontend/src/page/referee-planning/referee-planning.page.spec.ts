import { signal } from '@angular/core';
import { fakeAsync, flushMicrotasks, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of } from 'rxjs';
import { Tournament, WaterCarrierPlanning } from '@tournament-manager/persistent-data-model';
import { RefereePlanningComponent } from './referee-planning.page';
import { TournamentService } from '../../service/tournament.service';
import { UserService } from '../../service/user.service';
import { WaterCarrierService } from '../../service/water-carrier.service';
import { AttendeeService } from '../../service/attendee.service';
import { FragmentRefereeAllocationService } from '../../service/fragment-referee-allocation.service';
import { GameAttendeeAllocationService } from '../../service/game-attendee-allocation.service';
import { GameService } from '../../service/game.service';
import { TournamentRefereeAllocationService } from '../../service/tournament-referee-allocation.service';

/** Snapshot with two selectable public periods, requiring no protected collection reads. */
function snapshot(period = 'f1'): WaterCarrierPlanning {
  return {
    tournamentId: 't',
    tournamentName: 'Cup',
    timeZone: 'UTC',
    onlineEnabled: true,
    printedEnabled: true,
    periods: [
      { id: 'f1', label: 'Morning' },
      { id: 'f2', label: 'Afternoon' },
    ],
    selectedPeriodId: period,
    fields: [],
    timeslots: [],
    matches: [],
    actor: null,
  };
}

describe('RefereePlanningComponent public water-carrier loading', () => {
  let water: jasmine.SpyObj<WaterCarrierService>;
  let protectedRead: jasmine.Spy;
  const routeParams = convertToParamMap({ tournamentId: 't' });

  beforeEach(() => {
    water = jasmine.createSpyObj('WaterCarrierService', ['load']);
    water.load.and.resolveTo(snapshot());
    protectedRead = jasmine.createSpy('protectedRead').and.throwError('Anonymous Firestore read attempted');
    TestBed.configureTestingModule({
      imports: [RefereePlanningComponent],
      providers: [
        { provide: Router, useValue: {} },
        { provide: ActivatedRoute, useValue: { paramMap: of(routeParams), snapshot: { paramMap: routeParams } } },
        {
          provide: TournamentService,
          useValue: { currentTournament: signal({ id: 't', enablesModules: ['ONLINE_WATER_CARRIER'] } as Tournament) },
        },
        { provide: UserService, useValue: { currentUser$: signal(null) } },
        { provide: WaterCarrierService, useValue: water },
        ...[
          AttendeeService,
          FragmentRefereeAllocationService,
          GameAttendeeAllocationService,
          GameService,
          TournamentRefereeAllocationService,
        ].map((provide) => ({
          provide,
          useValue: {
            findByTournament: protectedRead,
            byTournament: protectedRead,
          },
        })),
      ],
    });
    TestBed.overrideComponent(RefereePlanningComponent, { set: { template: '', imports: [] } });
  });

  it('opens an anonymous deep link without relying on a locally selected tournament', fakeAsync(() => {
    const currentTournament = signal<Tournament | null>(null);
    const tournament = { id: 't', enablesModules: ['ONLINE_WATER_CARRIER'] } as Tournament;
    const byId = jasmine.createSpy('publicTournamentRead').and.returnValue(of(tournament));
    TestBed.overrideProvider(TournamentService, {
      useValue: {
        currentTournament,
        byId,
        setCurrentTournament: (value: Tournament) => currentTournament.set(value),
      },
    });
    const fixture = TestBed.createComponent(RefereePlanningComponent);
    fixture.detectChanges();
    flushMicrotasks();
    fixture.detectChanges();
    flushMicrotasks();
    expect(byId).toHaveBeenCalledOnceWith('t');
    expect(water.load).toHaveBeenCalledOnceWith('t', undefined);
    expect(protectedRead).not.toHaveBeenCalled();
    expect(fixture.componentInstance.selectedScopeId()).toBe('f1');
  }));

  it('initializes anonymous planning and the shared period selector with one API request', fakeAsync(() => {
    const fixture = TestBed.createComponent(RefereePlanningComponent);
    fixture.detectChanges();
    flushMicrotasks();
    expect(water.load).toHaveBeenCalledOnceWith('t', undefined);
    expect(protectedRead).not.toHaveBeenCalled();
    expect(fixture.componentInstance.tab()).toBe('water');
    expect(fixture.componentInstance.scopes().length).toBe(2);
  }));

  it('keeps the selected period on refresh and ignores an older response', fakeAsync(() => {
    const fixture = TestBed.createComponent(RefereePlanningComponent);
    fixture.detectChanges();
    flushMicrotasks();
    let complete!: (value: WaterCarrierPlanning) => void;
    water.load.and.returnValue(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    fixture.componentInstance.load();
    water.load.and.resolveTo(snapshot('f2'));
    fixture.componentInstance.selectScope('f2');
    flushMicrotasks();
    complete(snapshot('f1'));
    flushMicrotasks();
    expect(fixture.componentInstance.selectedScopeId()).toBe('f2');
    expect(water.load).toHaveBeenCalledWith('t', 'f2');
  }));

  it('reconciles a withdrawn fragment and reports reload failures separately from saved writes', fakeAsync(() => {
    const fixture = TestBed.createComponent(RefereePlanningComponent);
    fixture.detectChanges();
    flushMicrotasks();
    water.load.and.callFake((_id, fragmentId) =>
      fragmentId
        ? Promise.reject({ status: 403 })
        : Promise.resolve({ ...snapshot('f2'), periods: [{ id: 'f2', label: 'Afternoon' }] }),
    );
    fixture.componentInstance.load();
    flushMicrotasks();
    expect(fixture.componentInstance.selectedScopeId()).toBe('f2');
    water.load.and.rejectWith(new Error('Network error'));
    fixture.componentInstance.load();
    flushMicrotasks();
    expect(fixture.componentInstance.waterPlanning()).toBeNull();
    expect(fixture.componentInstance.error()).toContain('remains saved');
  }));
});
