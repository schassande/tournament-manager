import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { PickList } from 'primeng/picklist';
import { Attendee, createTournamentRefereeRanking } from '@tournament-manager/persistent-data-model';
import { RankingRefereesComponent } from './ranking-referees.component';

/** Creates a full-time attendee with independently varied filter attributes. */
function referee(id: string, gender: string, badge: number, category: string, upgrade: number): Attendee {
  return {
    id,
    roles: ['Referee'],
    isReferee: true,
    person: { firstName: id, lastName: 'Ref', gender },
    referee: { badge, category, upgrade: { badge: upgrade } },
  } as Attendee;
}

describe('Referees selection', () => {
  const available = [
    referee('alice', 'F', 2, 'O', 3),
    referee('bob', 'M', 1, 'S', 0),
    referee('charlie', 'M', 2, 'O', 3),
  ];
  const ranking = { ...createTournamentRefereeRanking('t', 'coach', 'Finals'), selectedRefereeAttendeeIds: ['alice'] };

  /** Creates the real PrimeNG view with required page inputs. */
  function setup() {
    TestBed.configureTestingModule({ imports: [RankingRefereesComponent], providers: [provideNoopAnimations()] });
    const fixture = TestBed.createComponent(RankingRefereesComponent);
    fixture.componentRef.setInput('ranking', structuredClone(ranking));
    fixture.componentRef.setInput('referees', available);
    fixture.detectChanges();
    return fixture;
  }

  it('filters available items across all four attributes without losing selected referees', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    component.setFilter('level', 2);
    component.setFilter('category', 'O');
    component.setFilter('upgrade', true);
    component.setFilter('gender', 'M');
    fixture.detectChanges();
    expect(component.source.map((item) => item.id)).toEqual(['charlie']);
    expect(component.target.map((item) => item.id)).toEqual(['alice']);
    component.setFilter('gender', 'F');
    fixture.detectChanges();
    expect(component.source).toEqual([]);
    expect(component.target.map((item) => item.id)).toEqual(['alice']);
  });

  it('handles native PickList buttons using disposable lists until persistence succeeds', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    const changes = spyOn(component.changes, 'emit');
    const remove = spyOn(component.remove, 'emit');
    const picklist = fixture.debugElement.query(By.directive(PickList)).componentInstance as PickList;
    const addButton = fixture.nativeElement.querySelector(
      '[data-pc-section="moveAllToTargetButton"]',
    ) as HTMLButtonElement;
    addButton.click();
    fixture.detectChanges();
    expect(changes).toHaveBeenCalledWith({ selectedRefereeAttendeeIds: ['alice', 'bob', 'charlie'] });
    expect(picklist.target?.map((item: Attendee) => item.id)).toEqual(['alice']);
    const removeButton = fixture.nativeElement.querySelector(
      '[data-pc-section="moveAllToSourceButton"]',
    ) as HTMLButtonElement;
    removeButton.click();
    fixture.detectChanges();
    expect(remove).toHaveBeenCalledWith(['alice']);
    expect(component.target.map((item) => item.id)).toEqual(['alice']);
    expect(component.ranking().selectedRefereeAttendeeIds).toEqual(['alice']);
    expect(picklist.target?.map((item: Attendee) => item.id)).toEqual(['alice']);
  });

  it('saves on native input blur and rejects invalid N without clamping to selected count', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    const changes = spyOn(component.changes, 'emit');
    const input = fixture.nativeElement.querySelector('input[type="number"]') as HTMLInputElement;
    for (const value of ['', '0', '-1', '1.5', '9007199254740992']) {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('blur'));
    }
    expect(changes).not.toHaveBeenCalled();
    input.value = '30';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    expect(changes).toHaveBeenCalledWith({ nbRefereesToRank: 30 });
  });

  it('keeps missing referee placeholders and blocks edits in CLOSED', () => {
    const fixture = setup();
    fixture.componentRef.setInput('ranking', { ...ranking, status: 'CLOSED', selectedRefereeAttendeeIds: ['missing'] });
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const remove = spyOn(component.remove, 'emit');
    component.removeItems(component.target);
    expect(remove).not.toHaveBeenCalled();
    expect(component.form.disabled).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Deleted referee');
  });
});
