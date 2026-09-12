import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Attendee, createTournamentRefereeRanking } from '@tournament-manager/persistent-data-model';
import { RankingCoachesComponent } from './ranking-coaches.component';

describe('Coaches configuration', () => {
  const ranking = {
    ...createTournamentRefereeRanking('t', 'coach', 'Finals'),
    selectedCoachAttendeeIds: ['coach'],
    voteMajority: 3,
  };
  const coaches = [
    { id: 'coach', tournamentId: 't', isRefereeCoach: true, person: { firstName: 'Alice', lastName: 'Coach' } },
    { id: 'other', tournamentId: 't', isRefereeCoach: true, person: { firstName: 'Bob', lastName: 'Coach' } },
  ] as Attendee[];

  /** Renders actual checkbox and numeric input bindings with shared page data. */
  function setup() {
    TestBed.configureTestingModule({ imports: [RankingCoachesComponent], providers: [provideNoopAnimations()] });
    const fixture = TestBed.createComponent(RankingCoachesComponent);
    fixture.componentRef.setInput('ranking', structuredClone(ranking));
    fixture.componentRef.setInput('coaches', coaches);
    fixture.detectChanges();
    return fixture;
  }

  it('emits native checkbox edits but keeps the committed check until confirmation or save succeeds', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    const emit = spyOn(component.changes, 'emit');
    const checkbox = fixture.nativeElement.querySelector('#ranking-coach-coach') as HTMLInputElement;
    checkbox.click();
    fixture.detectChanges();
    expect(emit).toHaveBeenCalledOnceWith({ selectedCoachAttendeeIds: [] });
    expect(checkbox.checked).toBeTrue();
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();
    expect(checkbox.disabled).toBeTrue();
    fixture.componentRef.setInput('busy', false);
    fixture.detectChanges();
    checkbox.click();
    fixture.detectChanges();
    expect(emit).toHaveBeenCalledTimes(2);
    fixture.componentRef.setInput('ranking', { ...ranking, selectedCoachAttendeeIds: [] });
    fixture.detectChanges();
    expect(checkbox.checked).toBeFalse();
    expect(component.majority.value).toBe(3);
  });

  it('validates numeric input on blur and accepts a majority above panel size without changing membership', () => {
    const fixture = setup();
    const emit = spyOn(fixture.componentInstance.changes, 'emit');
    const input = fixture.nativeElement.querySelector('#ranking-majority') as HTMLInputElement;
    for (const value of ['', '0', '-1', '1.5', '9007199254740992']) {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('blur'));
    }
    expect(emit).not.toHaveBeenCalled();
    input.value = '51';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    expect(emit).toHaveBeenCalledOnceWith({ voteMajority: 51 });
  });

  it('shows CLOSED configuration without permitting edits and replaces values on ranking switch', () => {
    const fixture = setup();
    fixture.componentRef.setInput('ranking', { ...ranking, status: 'CLOSED' });
    fixture.detectChanges();
    const emit = spyOn(fixture.componentInstance.changes, 'emit');
    fixture.componentInstance.toggleCoach(coaches[1], true);
    fixture.componentInstance.saveMajority();
    expect(emit).not.toHaveBeenCalled();
    expect((fixture.nativeElement.querySelector('#ranking-majority') as HTMLInputElement).disabled).toBeTrue();
    fixture.componentRef.setInput('ranking', {
      ...ranking,
      id: 'second',
      voteMajority: 8,
      selectedCoachAttendeeIds: [],
    });
    fixture.detectChanges();
    expect(fixture.componentInstance.majority.value).toBe(8);
    expect((fixture.nativeElement.querySelector('#ranking-coach-coach') as HTMLInputElement).checked).toBeFalse();
  });
});
