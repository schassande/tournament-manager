import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { DateService } from '../../service/date.service';
import { GameService } from '../../service/game.service';
import { TournamentService } from '../../service/tournament.service';
import { GamePasteContext, hasGameConflict, parseGamePaste } from './game-paste';
import { TournamentGamesComponent } from './tournament-games.page';

describe('Game spreadsheet paste', () => {
  let context: GamePasteContext;

  beforeEach(() => {
    context = {
      tournamentId: 'tournament',
      dayId: 'day',
      slots: [
        {
          id: 'slot',
          startStr: '09:00',
          start: 0,
          end: 60,
          duration: 60,
          playingSlot: true,
          slotType: {} as GamePasteContext['slots'][number]['slotType'],
        },
      ],
      fields: [{ id: 'field', name: 'Field 1', orderView: 0, video: false, quality: 1 }],
      divisions: [
        {
          id: 'division',
          name: 'Mixed',
          shortName: 'MX',
          backgroundColor: '',
          fontColor: '',
          teams: [
            { id: 'home', name: 'Team Alpha', shortName: 'A', divisionName: 'Mixed' },
            { id: 'away', name: 'Team Beta', shortName: 'B', divisionName: 'Mixed' },
          ],
        },
      ],
    };
  });

  it('maps seven columns including result required and accepts a header and CRLF', () => {
    const result = parseGamePaste(
      'Slot\tField\tDivision\tGame type\tResult Required?\tTeam 1\tTeam 2\r\n' +
        '09:00\tfield 1\tMX\tFinal\tYes\tA\tTeam Beta\r\n',
      context,
      [],
    );
    expect(result.errors).toEqual([]);
    expect(result.games[0]).toEqual(
      jasmine.objectContaining({
        timeslotId: 'slot',
        fieldId: 'field',
        divisionId: 'division',
        what: 'Final',
        homeTeamId: 'home',
        awayTeamId: 'away',
      }),
    );
    expect(result.games[0].resultRequired).toBeTrue();
  });

  it('parses explicit true and false values without changing team columns', () => {
    for (const value of ['Yes', 'OUI', 'true', '1', 'No', 'NON', 'false', '0']) {
      const result = parseGamePaste(`09:00\tfield\tMX\tPool\t${value}\tA\tB`, context, []);
      expect(result.errors).toEqual([]);
      expect(result.games[0].resultRequired).toBe(['Yes', 'OUI', 'true', '1'].includes(value));
      expect(result.games[0].homeTeamId).toBe('home');
      expect(result.games[0].awayTeamId).toBe('away');
    }
  });

  it('omits unspecified result required and reports invalid boolean values', () => {
    for (const row of ['09:00\tfield', '09:00\tfield\tMX\tPool\t\tA\tB']) {
      expect('resultRequired' in parseGamePaste(row, context, []).games[0]).toBeFalse();
    }
    const result = parseGamePaste('09:00\tfield\tMX\tPool\tmaybe', context, []);
    expect(result.games).toEqual([]);
    expect(result.errors[0]).toContain('Line 1: Result Required?');
  });

  it('accepts two columns when there is only one division', () => {
    const result = parseGamePaste('09:00\tfield', context, []);
    expect(result.errors).toEqual([]);
    expect(result.games[0].homeTeamId).toBe('');
  });

  it('preserves empty middle columns and the second team position', () => {
    const result = parseGamePaste('09:00\tfield\t\t\t\t\tB', context, []);
    expect(result.errors).toEqual([]);
    expect(result.games[0].homeTeamId).toBe('');
    expect(result.games[0].awayTeamId).toBe('away');
  });

  it('replaces imported fields while retaining the game ID and unrelated metadata', () => {
    const previous = {
      ...parseGamePaste('09:00\tfield\tMX\tPool\tYes\tA\tB', context, []).games[0],
      id: 'existing-game',
      scheduleId: 'schedule',
      fitGameId: 42,
    };
    const result = parseGamePaste('09:00\tField 1\tMX\tFinal\tNo\tB\tA', context, [previous]);
    expect(result.errors).toEqual([]);
    expect(result.games[0]).toEqual(
      jasmine.objectContaining({
        id: 'existing-game',
        scheduleId: 'schedule',
        fitGameId: 42,
        what: 'Final',
        resultRequired: false,
        homeTeamId: 'away',
        awayTeamId: 'home',
      }),
    );
    expect(previous.what).toBe('Pool');
    const cleared = parseGamePaste('09:00\tfield', context, [previous]).games[0];
    expect(cleared.id).toBe(previous.id);
    expect(cleared.homeTeamId).toBe('');
    expect(cleared.what).toBe('');
    expect('resultRequired' in cleared).toBeFalse();
  });

  it('does not pick an arbitrary game when saved positions are duplicated', () => {
    const game = parseGamePaste('09:00\tfield', context, []).games[0];
    const result = parseGamePaste('09:00\tfield', context, [
      { ...game, id: 'one' },
      { ...game, id: 'two' },
    ]);
    expect(result.games).toEqual([]);
    expect(result.errors[0]).toContain('replacement is ambiguous');
  });

  it('detects duplicates inside the clipboard despite different reference spellings', () => {
    const result = parseGamePaste('09:00\tfield\n09:00\tField 1', context, []);
    expect(result.errors[0]).toContain('Line 2:');
    expect(result.errors[0]).toContain('already occupied');
  });

  it('rejects unknown references, excess columns and missing required values', () => {
    for (const row of [
      '09:00\tMissing',
      '09:00\tfield\tMX\t\t\tOther',
      'slot',
      '\tfield',
      '09:00\tfield\tMX\t\t\t\t\textra',
    ]) {
      expect(parseGamePaste(row, context, []).errors.length).toBe(1);
    }
  });

  it('rejects an ambiguous division and requires a division in multi-division tournaments', () => {
    context.divisions.push({ ...context.divisions[0], id: 'other' });
    expect(parseGamePaste('09:00\tfield', context, []).errors.length).toBe(1);
    expect(parseGamePaste('09:00\tfield\tMX', context, []).errors.length).toBe(1);
  });

  it('allows moving a game to its own position but detects other occupants', () => {
    const game = { ...parseGamePaste('09:00\tfield', context, []).games[0], id: 'game' };
    expect(hasGameConflict([game], 'slot', 'field', 'game')).toBeFalse();
    expect(hasGameConflict([game], 'slot', 'field', 'other')).toBeTrue();
    expect(hasGameConflict([game], 'different-slot', 'field')).toBeFalse();
    expect(hasGameConflict([game], 'slot', 'different-field')).toBeFalse();
  });

  it('accepts only HH:MM and rejects unknown, ambiguous and non-playing slots', () => {
    for (const value of ['slot', '9:00', '24:00', '09:60', '10:00']) {
      expect(parseGamePaste(`${value}\tField 1`, context, []).errors.length).toBe(1);
    }
    context.slots.push({ ...context.slots[0], id: 'other' });
    expect(parseGamePaste('09:00\tField 1', context, []).errors[0]).toContain('ambiguous');
    context.slots = [{ ...context.slots[0], playingSlot: false }];
    expect(parseGamePaste('09:00\tField 1', context, []).games).toEqual([]);
  });

  it('resolves a later part slot and respects its field availability', () => {
    context.slots.push({ ...context.slots[0], id: 'afternoon', startStr: '14:00', availableFieldIds: ['field'] });
    expect(parseGamePaste('14:00\tField 1', context, []).games[0].timeslotId).toBe('afternoon');
    context.slots[1].availableFieldIds = [];
    expect(parseGamePaste('14:00\tField 1', context, []).errors[0]).toContain('unavailable');
  });

  for (const updating of [false, true]) {
    it(
      updating
        ? 'saves an update with the original ID and counts it separately'
        : 'saves none when clipboard rows conflict',
      async () => {
        const previous = { ...parseGamePaste('09:00\tfield', context, []).games[0], id: 'original-id' };
        const save = jasmine.createSpy('save').and.callFake((game) => of(game));
        TestBed.configureTestingModule({
          imports: [TournamentGamesComponent],
          providers: [
            { provide: Router, useValue: {} },
            { provide: DateService, useValue: { toTime: () => '09:00' } },
            {
              provide: TournamentService,
              useValue: {
                currentTournament: () => ({
                  id: context.tournamentId,
                  divisions: context.divisions,
                  days: [],
                  fields: context.fields,
                }),
              },
            },
            { provide: GameService, useValue: { byDay: () => of(updating ? [previous] : []), save } },
          ],
        });
        const fixture = TestBed.createComponent(TournamentGamesComponent);
        const component = fixture.componentInstance;
        component.selectedDay = {
          label: 'Day',
          value: {
            id: 'day',
            date: 0,
            parts: [
              {
                id: 'part',
                name: 'Part',
                dayId: 'day',
                timeslots: context.slots,
                allFieldsAvaillable: true,
                availableFieldIds: [],
              },
            ],
          },
        };
        const clipboardData = new DataTransfer();
        clipboardData.setData(
          'text/plain',
          updating ? '09:00\tField 1\tMX\tFinal\tNo\tB\tA' : '09:00\tField 1\n09:00\tField 1',
        );
        const event = new ClipboardEvent('paste', { clipboardData, cancelable: true });
        const paste = component.onPagePaste(event);
        expect(component.pasteInProgress()).toBeTrue();
        expect(component.pasteSummaryVisible).toBeFalse();
        await paste;
        expect(component.pasteInProgress()).toBeFalse();
        expect(event.defaultPrevented).toBeTrue();
        if (updating) {
          expect(save).toHaveBeenCalledOnceWith(
            jasmine.objectContaining({ id: 'original-id', what: 'Final', resultRequired: false }),
          );
          expect(component.updatedGameCount()).toBe(1);
          expect(component.ignoredPasteLines()).toEqual([]);
        } else {
          expect(save).not.toHaveBeenCalled();
          expect(component.ignoredPasteLines()[0]).toContain('Line 2:');
          expect(component.updatedGameCount()).toBe(0);
        }
        expect(component.savingPaste()).toBeFalse();
        expect(component.pasteSummaryVisible).toBeTrue();
        expect(component.pastedGameCount()).toBe(0);
        fixture.destroy();
      },
    );
  }
});
