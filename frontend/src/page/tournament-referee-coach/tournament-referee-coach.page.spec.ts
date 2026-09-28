import { signal } from '@angular/core';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';
import { of } from 'rxjs';
import { Attendee, attendeeRoleFlags, RefereeCoach, Tournament } from '@tournament-manager/persistent-data-model';
import { AttendeeService } from '../../service/attendee.service';
import { PersonService } from '../../service/person.service';
import { RegionService } from '../../service/region.service';
import { TournamentService } from '../../service/tournament.service';
import { TournamentRefereeCoachComponent } from './tournament-referee-coach.page';

describe('coach identity autosave', () => {
  let fixture: ComponentFixture<TournamentRefereeCoachComponent>;
  let page: TournamentRefereeCoachComponent;
  let attendees: jasmine.SpyObj<AttendeeService>;
  let coach: RefereeCoach;
  const currentTournament = signal<Tournament | null>(null);

  beforeEach(() => {
    currentTournament.set(null);
    attendees = jasmine.createSpyObj('AttendeeService', [
      'save', 'delete', 'isOnlyRefereeCoach', 'findTournamentRefereeCoaches',
    ]);
    attendees.findTournamentRefereeCoaches.and.returnValue(of([]));
    attendees.save.and.callFake(attendee => of(attendee));
    attendees.delete.and.resolveTo();
    attendees.isOnlyRefereeCoach.and.returnValue(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: AttendeeService, useValue: attendees },
        { provide: TournamentService, useValue: { currentTournament } },
        { provide: PersonService, useValue: {} },
        { provide: RegionService, useValue: {} },
        { provide: Router, useValue: {} },
        ConfirmationService,
        { provide: DialogService, useValue: {} },
      ],
    });
    fixture = TestBed.createComponent(TournamentRefereeCoachComponent);
    page = fixture.componentInstance;
    coach = {
      attendee: {
        id: 'coach-1',
        roles: ['Coach'],
        person: { firstName: 'A', lastName: 'Smith', shortName: '' },
      } as Attendee,
    };
  });

  it('saves only the latest typing after 500 ms of inactivity', fakeAsync(() => {
    page.scheduleAttendeeSave(coach);
    tick(300);
    coach.attendee.person!.firstName = 'Alice';
    page.scheduleAttendeeSave(coach);
    tick(499);
    expect(attendees.save).not.toHaveBeenCalled();
    tick(1);
    expect(attendees.save).toHaveBeenCalledTimes(1);
    expect(attendees.save.calls.mostRecent().args[0].person!.firstName).toBe('Alice');
  }));

  it('flushes on blur without a second save when the timer expires', fakeAsync(() => {
    page.scheduleAttendeeSave(coach);
    tick(100);
    page.flushAttendeeSave(coach);
    expect(attendees.save).toHaveBeenCalledTimes(1);
    tick(500);
    page.flushAttendeeSave(coach);
    expect(attendees.save).toHaveBeenCalledTimes(1);
  }));

  it('keeps the debounce independent for each coach', fakeAsync(() => {
    const other = structuredClone(coach);
    other.attendee.id = 'coach-2';
    page.scheduleAttendeeSave(coach);
    tick(200);
    page.scheduleAttendeeSave(other);
    tick(300);
    expect(attendees.save.calls.allArgs().map(([attendee]) => attendee.id)).toEqual(['coach-1']);
    tick(200);
    expect(attendees.save.calls.allArgs().map(([attendee]) => attendee.id)).toEqual(['coach-1', 'coach-2']);
  }));

  it('flushes pending typing when the page is destroyed', fakeAsync(() => {
    page.scheduleAttendeeSave(coach);
    fixture.destroy();
    expect(attendees.save).toHaveBeenCalledTimes(1);
    tick(500);
    expect(attendees.save).toHaveBeenCalledTimes(1);
  }));

  it('isolates current typing from mutations of the saved snapshot', fakeAsync(() => {
    page.scheduleAttendeeSave(coach);
    tick(500);
    const saved = attendees.save.calls.mostRecent().args[0];
    coach.attendee.person!.firstName = 'Alice';
    saved.person!.firstName = 'Old response';
    expect(coach.attendee.person!.firstName).toBe('Alice');
  }));

  it('consumes pending edits when another field saves immediately', fakeAsync(() => {
    page.scheduleAttendeeSave(coach);
    page.attendeeChanged(coach);
    tick(500);
    expect(attendees.save).toHaveBeenCalledTimes(1);
  }));

  it('cancels pending typing when the coach is removed', fakeAsync(() => {
    page.scheduleAttendeeSave(coach);
    void page['removeRefereeCoach'](coach);
    tick(500);
    expect(attendees.delete).toHaveBeenCalledWith('coach-1');
    expect(attendees.save).not.toHaveBeenCalled();
  }));

  it('keeps a created and edited coach visible after reloading server-derived roles', fakeAsync(() => {
    const persisted = new Map<string, Attendee>();
    currentTournament.set({ id: 'tournament-1', regionId: 'Europe', countryId: 'FRA' } as Tournament);
    // Reproduce the callable contract: flags come from roles, not client booleans.
    attendees.save.and.callFake(attendee => {
      const saved = structuredClone({
        ...attendee,
        id: attendee.id || 'created-coach',
        ...attendeeRoleFlags(attendee.roles),
      });
      persisted.set(saved.id, saved);
      Object.assign(attendee, structuredClone(saved));
      return of(saved);
    });
    attendees.findTournamentRefereeCoaches.and.callFake(() =>
      of(structuredClone([...persisted.values()].filter(attendee => attendee.isRefereeCoach))),
    );
    void page.addRefereeCoach();
    tick();
    const created = page.refereeCoaches()[0];
    created.attendee.person!.firstName = 'Alice';
    created.attendee.person!.lastName = 'Smith';
    page.scheduleAttendeeSave(created);
    tick(500);

    page.refereeCoaches.set([]);
    page.loadRefereeCoaches();
    expect(page.refereeCoaches().length).toBe(1);
    expect(page.refereeCoaches()[0].attendee.person!.firstName).toBe('Alice');
    expect(page.refereeCoaches()[0].attendee.person!.lastName).toBe('Smith');
    expect(page.refereeCoaches()[0].attendee.roles).toEqual(['Coach']);
  }));

  it('repairs missing coach roles on legacy rows while preserving other roles', () => {
    coach.attendee.roles = ['TournamentManager'];
    page.attendeeChanged(coach);
    const saved = attendees.save.calls.mostRecent().args[0];
    expect(saved.roles).toEqual(['TournamentManager', 'Coach']);
    expect(attendeeRoleFlags(saved.roles).isRefereeCoach).toBeTrue();
  });

  it('preserves an existing combined coach role without adding a duplicate role', () => {
    coach.attendee.roles = ['PlayerCoachReferee'];
    page.attendeeChanged(coach);
    expect(attendees.save.calls.mostRecent().args[0].roles).toEqual(['PlayerCoachReferee']);
  });
});
