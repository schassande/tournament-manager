import { CommonModule } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { firstValueFrom, map } from 'rxjs';
import { take } from 'rxjs/operators';
import { Day, Division, Game, PartDay, Field, Team, Timeslot } from '@tournament-manager/persistent-data-model';
import { AbstractTournamentPage } from '../../component/tournament-abstract.page';
import { DateService } from '../../service/date.service';
import { GameService } from '../../service/game.service';
import { hasGameConflict, parseGamePaste } from './game-paste';

/** Edits and imports the tournament game schedule. */
@Component({
  selector: 'app-tournament-games',
  imports: [
    DialogModule,
    ProgressSpinnerModule,
    ButtonModule,
    CommonModule,
    FormsModule,
    SelectButtonModule,
    SelectModule,
    TableModule,
  ],
  host: { '(document:paste)': 'onPagePaste($event)' },
  templateUrl: './tournament-games.page.html',
  styleUrl: './tournament-games.page.css',
})
export class TournamentGamesComponent extends AbstractTournamentPage {
  private dateService = inject(DateService);
  private gameService = inject(GameService);

  pasteSummaryVisible = false;
  pastedGameCount = signal(0);
  updatedGameCount = signal(0);
  ignoredPasteLines = signal<string[]>([]);
  pasteErrors = signal<string[]>([]);
  savingPaste = signal(false);
  /** Keeps the blocking import dialog open until the paste outcome is available. */
  pasteInProgress = signal(false);

  days = signal<DayView[]>([]);
  selectedDay: DayView | undefined;
  parts = signal<PartView[]>([]);
  showDivision = signal<boolean>(true);
  deletePartDayId = signal<string | null>(null);
  deletingPartDayId = signal<string | null>(null);

  /** Initializes the day selection when tournament data changes. */
  constructor() {
    super();
    effect(() => {
      if (this.tournament()) {
        this.showDivision.set(this.tournament()!.divisions.length > 1);
        this.days.update(() =>
          this.tournament()!.days.map((day: Day) => {
            return { label: this.dateService.toDate(day.date), value: day };
          }),
        );
        this.selectedDay = this.days()[0];
        this.selectedDayChanged();
        // console.log('effect', this.days, this.selectedDay);
      }
    });
  }
  /** Loads games for the selected day. */
  selectedDayChanged() {
    // console.log('selectedDayChanged', this.selectedDay);
    this.loadGames();
  }

  /** Opens the confirmation state for deleting one PartDay's games. */
  requestDeleteAllGames(part: PartView): void {
    if (this.savingPaste() || this.deletingPartDayId() !== null || !part.games.length) return;
    this.deletePartDayId.set(part.part.id);
  }

  /** Cancels the pending deletion confirmation. */
  cancelDeleteAllGames(): void {
    if (this.deletingPartDayId() === null) this.deletePartDayId.set(null);
  }

  /** Deletes every game belonging to the selected PartDay after confirmation. */
  deleteAllGames(part: PartView): void {
    if (
      this.savingPaste() ||
      this.deletePartDayId() !== part.part.id ||
      !this.selectedDay ||
      this.deletingPartDayId() !== null
    ) {
      return;
    }
    this.deletingPartDayId.set(part.part.id);
    this.gameService
      .byDay(this.tournament()!.id, this.selectedDay.value.id)
      .pipe(take(1))
      .subscribe({
        next: (games) => {
          const partSlotIds = new Set(part.part.timeslots.map((slot) => slot.id));
          const partGames = games.filter((game) => partSlotIds.has(game.timeslotId));
          Promise.all(partGames.map((game) => this.gameService.delete(game.id)))
            .then(() => {
              this.deletePartDayId.set(null);
              this.deletingPartDayId.set(null);
              this.loadGames();
            })
            .catch(() => {
              this.deletePartDayId.set(null);
              this.deletingPartDayId.set(null);
            });
        },
        error: () => {
          this.deletePartDayId.set(null);
          this.deletingPartDayId.set(null);
        },
      });
  }
  /** Loads the selected day and resolves game references for display. */
  private loadGames() {
    if (!this.selectedDay) return;
    // console.log('loadGames', this.selectedDay);
    this.gameService
      .byDay(this.tournament()!.id, this.selectedDay.value.id)
      .pipe(
        map((games: Game[]) => {
          console.debug('games', games);
          this.parts.set(
            this.selectedDay!.value.parts.map((part: PartDay) => {
              console.debug('PartDay ', part);
              // list of Part timeslots
              const playingTimeSlots: TimeSlotView[] = part.timeslots
                .filter((ts: Timeslot) => ts.playingSlot)
                .map((ts: Timeslot) => {
                  return {
                    ...ts,
                    startStr: this.dateService.toTime(ts.start),
                    endStr: this.dateService.toTime(ts.end),
                  };
                });
              console.debug('playingTimeSlots ', playingTimeSlots);
              // extract GameView of game belonging the Part
              const gvs: GameView[] = games
                .filter((game: Game) => part.timeslots.some((slot) => slot.id === game.timeslotId))
                .map((game: Game) => {
                  const division = this.tournament()!.divisions.find(
                    (division: Division) => division.id === game.divisionId,
                  );
                  const homeTeam = division
                    ? division!.teams.find((team: Team) => team.id === game.homeTeamId)
                    : undefined;
                  const awayTeam = division
                    ? division!.teams.find((team: Team) => team.id === game.awayTeamId)
                    : undefined;
                  const timeslot = playingTimeSlots.find((ts) => ts.id === game.timeslotId);
                  return {
                    game,
                    division,
                    timeslot,
                    timeslotStr: timeslot ? this.dateService.toTime(timeslot.start) : '',
                    field: this.tournament()!.fields.find((field: Field) => field.id === game.fieldId),
                    homeTeam,
                    awayTeam,
                  };
                })
                .filter((g) => g.timeslot);
              const fields: Field[] = [];
              if (part.allFieldsAvaillable) {
                fields.push(...this.tournament()!.fields);
              } else {
                part.availableFieldIds.forEach((fieldId: string) => {
                  const f = this.tournament()!.fields.find((field: Field) => field.id === fieldId);
                  if (f) fields.push(f);
                });
              }
              this.sortGames(gvs);
              return { part, games: gvs, fields, playingTimeSlots };
            }),
          );
        }),
      )
      .subscribe();
  }
  /** Sorts games by start time and field order. */
  private sortGames(gvs: GameView[]) {
    gvs.sort((a: GameView, b: GameView) => {
      let res = a.timeslot!.start - b.timeslot!.start;
      return res === 0 ? a.field!.orderView - b.field!.orderView : res;
    });
  }
  /** Adds a game only when a free slot and field exist. */
  async addGame(pv: PartView): Promise<void> {
    if (this.savingPaste() || this.deletingPartDayId() !== null) return;
    this.savingPaste.set(true);
    this.pasteErrors.set([]);
    try {
      const existing = await firstValueFrom(this.gameService.byDay(this.tournament()!.id, this.selectedDay!.value.id));
      const position = pv.playingTimeSlots
        .flatMap((slot) => pv.fields.map((field) => ({ slot, field })))
        .find(({ slot, field }) => !hasGameConflict(existing, slot.id, field.id));
      if (!position || !this.tournament()!.divisions.length) {
        this.pasteErrors.set(['No free slot/field or no configured division.']);
        return;
      }
      const game: Game = {
        id: '',
        lastChange: Date.now(),
        tournamentId: this.tournament()!.id,
        dayId: this.selectedDay!.value.id,
        timeslotId: position.slot.id,
        fieldId: position.field.id,
        divisionId: this.tournament()!.divisions[0].id,
        homeTeamId: '',
        awayTeamId: '',
        scheduleId: '',
        what: '',
      };
      await firstValueFrom(this.gameService.save(game));
      this.loadGames();
    } catch (error) {
      this.pasteErrors.set([`Could not add game: ${String(error)}`]);
    } finally {
      this.savingPaste.set(false);
    }
  }

  /** Imports clipboard rows on this page, preserving ordinary text pastes in cell editors. */
  async onPagePaste(event: ClipboardEvent): Promise<void> {
    const text = event.clipboardData?.getData('text/plain') ?? '';
    const target = event.target;
    const editing = target instanceof HTMLElement && target.closest('input, textarea, [contenteditable="true"]');
    if (editing && !text.includes('\t') && !/[\r\n]/.test(text)) return;
    event.preventDefault();
    if (this.savingPaste() || this.deletingPartDayId() !== null) return;
    await this.pasteGames(text);
  }

  /** Resolves clipboard slots across the selected day and displays the import outcome. */
  async pasteGames(text: string): Promise<void> {
    if (this.savingPaste() || this.deletingPartDayId() !== null) return;
    this.pasteInProgress.set(true);
    this.savingPaste.set(true);
    this.pastedGameCount.set(0);
    this.updatedGameCount.set(0);
    this.ignoredPasteLines.set([]);
    this.pasteSummaryVisible = false;
    try {
      const tournament = this.tournament();
      const day = this.selectedDay?.value;
      if (!tournament || !day) {
        this.ignoredPasteLines.set(['No selected tournament day.']);
        return;
      }
      const existing = await firstValueFrom(this.gameService.byDay(tournament.id, day.id));
      // Each slot carries the field availability of its own part of the selected day.
      const slots = day.parts.flatMap((part) =>
        part.timeslots.map((slot) => ({
          ...slot,
          startStr: this.dateService.toTime(slot.start),
          availableFieldIds: part.allFieldsAvaillable
            ? tournament.fields.map((field) => field.id)
            : part.availableFieldIds,
        })),
      );
      const result = parseGamePaste(
        text,
        {
          tournamentId: tournament.id,
          dayId: day.id,
          slots,
          fields: tournament.fields,
          divisions: tournament.divisions,
        },
        existing,
      );
      this.ignoredPasteLines.set(result.errors);
      if (result.errors.length) return;
      for (const game of result.games) {
        const updating = !!game.id;
        await firstValueFrom(this.gameService.save(game));
        if (updating) this.updatedGameCount.update((count) => count + 1);
        else this.pastedGameCount.update((count) => count + 1);
      }
      this.loadGames();
    } catch (error) {
      this.ignoredPasteLines.update((lines) => [...lines, `Import failed: ${String(error)}`]);
      this.loadGames();
    } finally {
      this.savingPaste.set(false);
      this.pasteInProgress.set(false);
      this.pasteSummaryVisible = true;
    }
  }

  /** Rejects an occupied position before changing the currently displayed game. */
  private async canMoveGame(gv: GameView, slotId: string, fieldId: string): Promise<boolean> {
    if (this.savingPaste() || this.deletingPartDayId() !== null) return false;
    this.savingPaste.set(true);
    this.pasteErrors.set([]);
    try {
      const existing = await firstValueFrom(this.gameService.byDay(gv.game.tournamentId, gv.game.dayId));
      if (hasGameConflict(existing, slotId, fieldId, gv.game.id)) {
        this.pasteErrors.set(['This slot / field is already occupied.']);
        return false;
      }
      await firstValueFrom(this.gameService.save({ ...gv.game, timeslotId: slotId, fieldId }));
      return true;
    } catch (error) {
      this.pasteErrors.set([`Could not move game: ${String(error)}`]);
      return false;
    } finally {
      this.savingPaste.set(false);
    }
  }
  /** Removes the selected game from storage and the view. */
  removeGame(gv: GameView) {
    if (this.savingPaste()) return;
    this.gameService.delete(gv.game.id);
    this.parts.update((parts) => {
      const part = parts.find((p) => p.games.some((game) => game.game.id === gv.game.id));
      if (part) {
        part.games = part.games.filter((g) => g.game.id !== gv.game.id);
      }
      return parts;
    });
    this.partsChanged();
  }
  /** Refreshes the table after an inline edit. */
  private partsChanged() {
    this.parts.update((parts) => [...parts]);
  }
  /** Changes a slot only when the game's field is free there. */
  async timeSlotSelected(part: PartView, gv: GameView, timeslotId: string): Promise<void> {
    if (part.playingTimeSlots.some((slot) => slot.id === timeslotId)) {
      await this.canMoveGame(gv, timeslotId, gv.game.fieldId);
    }
    this.loadGames();
  }

  /** Changes a field only when it is free during the game's slot. */
  async fieldSelected(part: PartView, gv: GameView, fieldId: string): Promise<void> {
    if (part.fields.some((field) => field.id === fieldId)) {
      await this.canMoveGame(gv, gv.game.timeslotId, fieldId);
    }
    this.loadGames();
  }
  /** Changes the division and initializes its available teams. */
  divisionSelected(gv: GameView, divisionId: string) {
    gv.game.divisionId = divisionId;
    gv.division = this.tournament()!.divisions.find((division: Division) => division.id === divisionId);

    gv.homeTeam = gv.division!.teams[0];
    gv.game.homeTeamId = gv.homeTeam?.id ?? '';

    gv.awayTeam = gv.division!.teams[1];
    gv.game.awayTeamId = gv.awayTeam?.id ?? '';

    this.gameService.save(gv.game).subscribe();
    this.partsChanged();
  }
  /** Saves the edited game type. */
  gameWhatChanged(gv: GameView) {
    this.gameService.save(gv.game).subscribe();
    this.partsChanged();
  }
  /** Saves the selected home or away team. */
  teamSelected(gv: GameView, isHome: boolean, teamId: string) {
    if (isHome) {
      gv.game.homeTeamId = teamId;
      gv.homeTeam = gv.division!.teams.find((team: Team) => team.id === teamId);
    } else {
      gv.game.awayTeamId = teamId;
      gv.awayTeam = gv.division!.teams.find((team: Team) => team.id === teamId);
    }
    this.gameService.save(gv.game).subscribe();
    this.partsChanged();
  }
}

/** A selectable tournament day. */
interface DayView {
  label: string;
  value: Day;
}
/** A playing slot with formatted start and end times. */
interface TimeSlotView extends Timeslot {
  startStr: string;
  endStr: string;
}
/** Games and available positions in a part of a day. */
interface PartView {
  part: PartDay;
  games: GameView[];
  playingTimeSlots: TimeSlotView[];
  fields: Field[];
}
/** A game and its resolved display references. */
interface GameView {
  game: Game;
  division?: Division;
  timeslot?: Timeslot;
  timeslotStr: string;
  field?: Field;
  homeTeam?: Team;
  awayTeam?: Team;
}
