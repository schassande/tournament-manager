import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { Table } from 'primeng/table';
import { Division } from '@tournament-manager/persistent-data-model';
import { TournamentDivisionEditComponent } from './tournament-division-edit.component';

describe('TournamentDivisionEditComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TournamentDivisionEditComponent],
      providers: [provideNoopAnimations()],
    });
  });

  for (const [columnIndex, field] of ['name', 'shortName'].entries()) {
    it(`keeps the same editor open while typing a team ${field}`, fakeAsync(() => {
      const fixture = TestBed.createComponent(TournamentDivisionEditComponent);
      const division = testDivision('100');
      fixture.componentRef.setInput('division', division);
      fixture.componentRef.setInput('tournament', { divisions: [division] });
      fixture.detectChanges();
      tick();
      const cell: HTMLElement = fixture.nativeElement.querySelectorAll('p-table')[1].querySelectorAll('tbody td')[
        columnIndex
      ];
      cell.click();
      fixture.detectChanges();
      tick(50);
      const input = cell.querySelector('input')!;
      expect(input).toBeTruthy();
      const table = fixture.debugElement.queryAll(By.directive(Table))[1].componentInstance as Table;
      const updateEditingCell = spyOn(table, 'updateEditingCell').and.callThrough();
      for (const name of ['A', 'AB', 'ABC']) {
        input.value = name;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        fixture.detectChanges();
        tick();
        fixture.detectChanges();
        expect(cell.querySelector('input')).toBe(input);
        expect(field === 'name' ? division.teams[0].name : division.teams[0].shortName).toBe(name);
      }
      expect(updateEditingCell).not.toHaveBeenCalled();
      fixture.destroy();
    }));
  }

  for (const method of ['onPasteTeamNames', 'onPasteTeamShortNames'] as const) {
    it(`updates existing teams and appends distinct teams using ${method}`, () => {
      const fixture = TestBed.createComponent(TournamentDivisionEditComponent);
      const division = testDivision('open');
      fixture.componentRef.setInput('division', division);
      fixture.componentRef.setInput('tournament', { divisions: [division] });
      const clipboardData = new DataTransfer();
      clipboardData.setData('text', 'First\nSecond\nThird');
      const event = new ClipboardEvent('paste', { clipboardData, cancelable: true });
      fixture.componentInstance[method](event, 0);
      expect(event.defaultPrevented).toBeTrue();
      expect(division.teams[0].id).toBe('NaN');
      expect(division.teams.map((team) => (method === 'onPasteTeamNames' ? team.name : team.shortName))).toEqual([
        'First',
        'Second',
        'Third',
      ]);
      expect(new Set(division.teams.map((team) => team.id)).size).toBe(3);
    });
  }

  for (const id of ['open', '9007199254740992', String(Number.MAX_SAFE_INTEGER)]) {
    it(`allocates distinct team IDs for division ${id}`, () => {
      const fixture = TestBed.createComponent(TournamentDivisionEditComponent);
      const division = testDivision(id);
      fixture.componentRef.setInput('division', division);
      fixture.componentRef.setInput('tournament', { divisions: [division] });
      fixture.componentInstance.addTeam();
      fixture.componentInstance.addTeam();
      const ids = division.teams.map((team) => team.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.slice(1)).not.toContain('NaN');
    });
  }
});

/** Creates a division containing a legacy team with an invalid generated ID. */
function testDivision(id: string): Division {
  return {
    id,
    name: 'Open',
    shortName: 'O',
    backgroundColor: '#ffffff',
    fontColor: '#000000',
    teams: [{ id: 'NaN', name: 'Team', shortName: 'T', divisionName: 'Open', playerIds: [] }],
  };
}
