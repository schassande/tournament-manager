import { TestBed } from '@angular/core/testing';
import * as XLSX from 'xlsx';
import {
  Attendee,
  CoachRefereesRanking,
  createTournamentRefereeRanking,
} from '@tournament-manager/persistent-data-model';
import { PanelRankingExportService } from '../../service/panel-ranking-export.service';
import { buildPanelTable } from './panel-table';
import { RankingPanelComponent } from './ranking-panel.component';

describe('Panel comparison and Excel', () => {
  const ranking = {
    ...createTournamentRefereeRanking('t', 'actor', 'Finals'),
    id: 'r',
    selectedRefereeAttendeeIds: ['A', 'missing'],
    selectedCoachAttendeeIds: ['z', 'a'],
    status: 'PANEL_RANKING' as const,
    panelResultState: 'STALE' as const,
    panelRefereesRanking: { rankingLastChange: 'old', rankedRefereeAttendeeIds: ['missing'], stats: [[1, 3, 5]] },
  };
  const attendees = new Map([
    ['a', { id: 'a', person: { shortName: 'Alice' } } as Attendee],
    ['z', { id: 'z', person: { shortName: 'Zoe' } } as Attendee],
    ['p', { id: 'p', person: { shortName: 'Aaron' } } as Attendee],
    [
      'A',
      {
        id: 'A',
        person: { firstName: 'Jean', lastName: 'Dupont' },
        referee: { badge: 2, category: 'S', upgrade: { badge: 3 } },
      } as Attendee,
    ],
  ]);
  const votes = [
    { coachAttendeeId: 'p', locked: true, rankedRefereeAttendeeIds: ['A', 'missing'] },
    { coachAttendeeId: 'z', locked: true, rankedRefereeAttendeeIds: [] },
    { coachAttendeeId: 'a', locked: false, rankedRefereeAttendeeIds: ['missing'] },
  ] as CoachRefereesRanking[];

  it('explains saved empty results without mistaking unlocked or practice votes for contributions', () => {
    const fixture = TestBed.createComponent(RankingPanelComponent);
    const empty = {
      ...ranking,
      panelResultState: 'CURRENT',
      voteMajority: 2,
      panelRefereesRanking: { rankingLastChange: 'saved', rankedRefereeAttendeeIds: [], stats: [] },
    };
    fixture.componentRef.setInput('ranking', empty);
    fixture.componentRef.setInput(
      'coachRankings',
      votes.filter((vote) => vote.coachAttendeeId !== 'z'),
    );
    fixture.componentRef.setInput('attendees', attendees);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain(
      'no selected coach ranking is locked',
    );
    expect(fixture.nativeElement.textContent).toContain('then compute again');
    fixture.componentRef.setInput('coachRankings', votes);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('vote majority of 2');
    fixture.componentRef.setInput('ranking', { ...empty, panelResultState: 'NOT_COMPUTED' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
    fixture.componentRef.setInput('ranking', { ...empty, status: 'CLOSED' });
    fixture.componentRef.setInput('coachRankings', []);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('then compute again');
  });

  it('orders selected coaches by short name before practice, keeping unlocked and empty columns', () => {
    const table = buildPanelTable(ranking, votes, attendees);
    expect(table.headers).toEqual([
      'Rank',
      'Panel referee',
      'Panel statistics',
      'Rank',
      'Alice (Unlocked)',
      'Zoe',
      'Aaron (Practice)',
    ]);
    expect(table.rows).toEqual([
      [1, 'Deleted referee', '[1, 3, 5]', 1, 'Deleted referee', '', 'L2S* Jean DUPONT'],
      [2, '', '', 2, '', '', 'Deleted referee'],
    ]);
    const service = TestBed.inject(PanelRankingExportService);
    const workbook = service.workbook(ranking, table);
    const reopened = XLSX.read(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }), { type: 'array' });
    expect(reopened.SheetNames).toEqual(['Panel']);
    expect(XLSX.utils.sheet_to_json(reopened.Sheets['Panel'], { header: 1 })).toEqual([
      ['Ranking', 'Finals'],
      ['Status', 'PANEL_RANKING'],
      ['Result', 'Recompute required'],
      [],
      table.headers,
      ...table.rows,
    ]);
  });

  it('renders saved rows in CLOSED and the missing-selection empty state without page actions', () => {
    const fixture = TestBed.createComponent(RankingPanelComponent);
    fixture.componentRef.setInput('ranking', ranking);
    fixture.componentRef.setInput('coachRankings', votes);
    fixture.componentRef.setInput('attendees', attendees);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(2);
    fixture.componentRef.setInput('ranking', { ...ranking, status: 'CLOSED' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(2);
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
    fixture.componentRef.setInput('ranking', { ...ranking, selectedRefereeAttendeeIds: [] });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toBe('Configure referees first');
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });
});
