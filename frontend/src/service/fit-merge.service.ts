import { Injectable, inject } from '@angular/core';
import {
  Day,
  BasicDivisions,
  defaultSloTypes,
  defaultSlotType,
  Division,
  Field,
  Game,
  PartDay,
  SlotType,
  Team,
  Timeslot,
  Tournament,
} from '@tournament-manager/persistent-data-model';
import { Observable, forkJoin, from, of } from 'rxjs';
import { concatMap, map } from 'rxjs/operators';
import { DateService } from './date.service';
import { FitGame, FITData, toCategory } from './fit-import.service';
import { GameService } from './game.service';
import { TournamentService } from './tournament.service';

export type FitMergeAction =
  | 'Create'
  | 'Update'
  | 'Delete'
  | 'Keep'
  | 'Skip'
  | 'Conflict';

export interface FitMergeChange {
  type: 'Division' | 'Team' | 'Field' | 'Day' | 'Timeslot' | 'Game';
  key: string;
  action: FitMergeAction;
  details: string;
  warning?: boolean;
}

export interface FitMergePlan {
  operation: 'structure' | 'day' | 'all-days';
  date?: string;
  tournament: Tournament;
  gamesToSave: Game[];
  gameIdsToDelete: string[];
  changes: FitMergeChange[];
  warnings: string[];
  errors: string[];
}

/** Builds and applies non-destructive FIT structure and day import plans. */
@Injectable({ providedIn: 'root' })
export class FitMergeService {
  private readonly dateService = inject(DateService);
  private readonly gameService = inject(GameService);
  private readonly tournamentService = inject(TournamentService);

  /** Builds the preview plan for the complete FIT structure import. */
  prepareStructure(
    tournament: Tournament,
    fit: FITData,
    existingGames: Game[] = [],
  ): FitMergePlan {
    const target = this.clone(tournament);
    const plan = this.emptyPlan('structure', target);
    const previousDayDates = new Map(
      tournament.days.map((day) => [day.id, this.dateService.toDate(day.date)]),
    );
    this.mergeStructure(target, fit, plan);
    this.renumberDays(target, existingGames, previousDayDates, plan);
    return plan;
  }

  /** Builds the preview plan for importing one FIT competition day. */
  prepareDay(
    tournament: Tournament,
    fit: FITData,
    date: string,
    existingGames: Game[],
  ): FitMergePlan {
    const target = this.clone(tournament);
    const plan = this.emptyPlan('day', target, date);
    this.mergeGames(target, fit, date, existingGames, plan);
    return plan;
  }

  /** Builds the preview plan for importing every dated FIT match at once. */
  prepareAllDays(
    tournament: Tournament,
    fit: FITData,
    existingGames: Game[],
  ): FitMergePlan {
    const target = this.clone(tournament);
    const plan = this.emptyPlan('all-days', target);
    const uniqueFit = {
      ...fit,
      games: this.uniqueFitGames(fit.games),
    };
    for (const day of fit.days) {
      this.mergeGames(target, uniqueFit, day.date, existingGames, plan);
    }
    return plan;
  }

  /** Applies a validated plan. No merge preview is persisted. */
  apply(plan: FitMergePlan): Observable<void> {
    if (plan.errors.length) {
      throw new Error(
        'The FIT import cannot be applied while validation errors remain.',
      );
    }
    return this.tournamentService.save(plan.tournament).pipe(
      concatMap(() => {
        const saves = plan.gamesToSave.map((game) =>
          this.gameService.save(game),
        );
        const deletes = plan.gameIdsToDelete.map((id) =>
          from(this.gameService.delete(id)),
        );
        const operations = [...saves, ...deletes];
        return operations.length
          ? forkJoin(operations).pipe(map(() => undefined))
          : of(undefined);
      }),
    );
  }

  /** Returns whether an application score protects a match from FIT updates. */
  hasSignificantScore(game: Game): boolean {
    return (
      !!game.score &&
      (game.score.homeTeamScore !== 0 || game.score.awayTeamScore !== 0)
    );
  }

  private emptyPlan(
    operation: 'structure' | 'day' | 'all-days',
    tournament: Tournament,
    date?: string,
  ): FitMergePlan {
    return {
      operation,
      date,
      tournament,
      gamesToSave: [],
      gameIdsToDelete: [],
      changes: [],
      warnings: [],
      errors: [],
    };
  }

  private mergeStructure(
    tournament: Tournament,
    fit: FITData,
    plan: FitMergePlan,
  ): void {
    tournament.fit = {
      competitionSlug: fit.competitionSlug,
      season: fit.season,
      targetTimeZone: fit.targetTimeZone,
      renaming: fit.renaming,
      lastImportDate: tournament.fit?.lastImportDate ?? fit.importDate,
    };
    const divisionNames = new Set<string>();
    const importedDivisionIds = new Set<string>();
    const importedFieldIds = new Set<string>();
    const importedDayDates = new Set<string>();

    for (const fitDivision of fit.divisions) {
      const divisionName = this.divisionName(fit, fitDivision.name);
      if (divisionNames.has(divisionName)) {
        plan.errors.push(`Duplicate FIT division name: ${divisionName}`);
        continue;
      }
      divisionNames.add(divisionName);
      const division = this.findDivision(
        tournament,
        fitDivision.fitSlug,
        divisionName,
      );
      const action: FitMergeAction = division ? 'Update' : 'Create';
      const targetDivision =
        division ?? this.newDivision(divisionName, fitDivision.fitSlug);
      const basicDivision = this.findBasicDivision(
        fitDivision.name,
        divisionName,
        division?.shortName,
      );
      targetDivision.name = divisionName;
      targetDivision.shortName =
        basicDivision?.shortName ?? targetDivision.shortName ?? divisionName;
      if (basicDivision) {
        targetDivision.backgroundColor = basicDivision.backgroundColor;
        targetDivision.fontColor = basicDivision.fontColor;
      }
      targetDivision.fitSlug = fitDivision.fitSlug;
      if (!division) tournament.divisions.push(targetDivision);
      importedDivisionIds.add(targetDivision.id);
      plan.changes.push({
        type: 'Division',
        key: divisionName,
        action,
        details: `${action} division ${divisionName}`,
      });

      const importedTeamIds = new Set<string>();
      for (const fitTeam of fitDivision.teams) {
        const team = this.findTeam(
          targetDivision,
          fitDivision.fitSlug,
          fitTeam.fitSlug,
          fitTeam.name,
        );
        const teamAction: FitMergeAction = team ? 'Update' : 'Create';
        const targetTeam =
          team ??
          this.newTeam(
            fitTeam.name,
            targetDivision.name,
            fitDivision.fitSlug,
            fitTeam.fitSlug,
          );
        targetTeam.name = fitTeam.name;
        targetTeam.divisionName = targetDivision.name;
        targetTeam.fitDivisionSlug = fitDivision.fitSlug;
        targetTeam.fitSlug = fitTeam.fitSlug;
        targetTeam.shortName = targetTeam.shortName || fitTeam.name;
        if (!team) targetDivision.teams.push(targetTeam);
        importedTeamIds.add(targetTeam.id);
        plan.changes.push({
          type: 'Team',
          key: `${divisionName}/${fitTeam.name}`,
          action: teamAction,
          details: `${teamAction} team ${fitTeam.name}`,
        });
      }
      for (const localTeam of [...targetDivision.teams]) {
        if (localTeam.fitSlug && !importedTeamIds.has(localTeam.id)) {
          targetDivision.teams = targetDivision.teams.filter(
            (item) => item.id !== localTeam.id,
          );
          plan.changes.push({
            type: 'Team',
            key: `${divisionName}/${localTeam.name}`,
            action: 'Delete',
            details: 'FIT team is absent from the snapshot',
          });
        }
      }
    }

    for (const localDivision of [...tournament.divisions]) {
      if (!importedDivisionIds.has(localDivision.id)) {
        tournament.divisions = tournament.divisions.filter(
          (item) => item.id !== localDivision.id,
        );
        plan.changes.push({
          type: 'Division',
          key: localDivision.name,
          action: 'Delete',
          details: 'FIT division is absent from the snapshot',
        });
      }
    }

    const fitFields = new Set(
      fit.games.map((game) => game.field).filter(Boolean),
    );
    for (const fitField of fitFields) {
      const field = tournament.fields.find((item) => item.name === fitField);
      const target =
        field ?? this.newField(fitField, tournament.fields.length + 1);
      if (!field) tournament.fields.push(target);
      importedFieldIds.add(target.id);
      plan.changes.push({
        type: 'Field',
        key: fitField,
        action: field ? 'Update' : 'Create',
        details: `${field ? 'Keep' : 'Create'} field ${fitField}`,
      });
    }
    for (const field of [...tournament.fields]) {
      if (!importedFieldIds.has(field.id) && fitFields.size > 0 && field.name) {
        tournament.fields = tournament.fields.filter(
          (item) => item.id !== field.id,
        );
        plan.changes.push({
          type: 'Field',
          key: field.name,
          action: 'Delete',
          details: 'FIT field is absent from the snapshot',
        });
      }
    }

    for (const fitDay of fit.days) {
      importedDayDates.add(fitDay.date);
      const day = this.findOrCreateDay(tournament, fitDay.date);
      if (!day.created)
        plan.changes.push({
          type: 'Day',
          key: fitDay.date,
          action: 'Keep',
          details: 'Reuse existing day',
        });
      else
        plan.changes.push({
          type: 'Day',
          key: fitDay.date,
          action: 'Create',
          details: 'Create day required by FIT timeslots',
        });
      const part = this.firstPart(day.value);
      const desired = this.buildTimeslots(
        fit,
        fitDay.date,
        fitDay.timeslots,
        plan,
      );
      const currentByTime = new Map(
        day.value.parts.flatMap(currentPart => currentPart.timeslots).map((slot) => [
          this.dateService.toTime(slot.start),
          slot,
        ]),
      );
      day.value.parts.forEach(currentPart => currentPart.timeslots = []);
      let start = this.dateService.fromTime(
        day.value.date,
        fitDay.timeslots[0] ?? '09:00',
      );
      for (const item of desired) {
        if (item.fitTime)
          start = this.dateService.fromTime(day.value.date, item.fitTime);
        const existing = currentByTime.get(this.dateService.toTime(start));
        const slot: Timeslot = existing ?? {
          id: this.newId('timeslot'),
          start,
          duration: 0,
          end: 0,
          slotType: item.slotType,
          playingSlot: item.slotType.playTime > 0,
        };
        slot.start = start;
        slot.slotType = item.slotType;
        slot.duration = item.slotType.totalDuration * 60 * 1000;
        slot.end = this.dateService.addMilli(start, slot.duration);
        slot.playingSlot = item.slotType.playTime > 0;
        part.timeslots.push(slot);
        plan.changes.push({
          type: 'Timeslot',
          key: `${fitDay.date}/${this.dateService.toTime(start)}`,
          action: existing ? 'Update' : 'Create',
          details: `${existing ? 'Update' : 'Create'} ${item.slotType.name}`,
        });
        start = slot.end;
      }
    }
    for (const localDay of [...tournament.days]) {
      const localDate = this.dateService.toDate(localDay.date);
      if (!importedDayDates.has(localDate)) {
        tournament.days = tournament.days.filter(
          (item) => item.id !== localDay.id,
        );
        plan.changes.push({
          type: 'Day',
          key: localDate,
          action: 'Delete',
          details: 'FIT day is absent from the snapshot',
        });
      }
    }
  }

  private mergeGames(
    tournament: Tournament,
    fit: FITData,
    date: string,
    existingGames: Game[],
    plan: FitMergePlan,
  ): void {
    const day = tournament.days.find(
      (item) => this.dateService.toDate(item.date) === date,
    );
    if (!day) {
      plan.errors.push(`Missing tournament day ${date}`);
      return;
    }
    const fitGames = this.uniqueFitGames(
      fit.games.filter((game) => game.date === date),
    );
    const existingByFitId = new Map(
      existingGames
        .filter((game) => game.fitGameId !== undefined)
        .map((game) => [game.fitGameId!, game]),
    );
    const touched = new Set<string>();
    for (const fitGame of fitGames) {
      const division = tournament.divisions.find(
        (item) => item.name === fitGame.division,
      );
      const homeTeam = division?.teams.find(
        (team) => team.name === fitGame.teamHome,
      );
      const awayTeam = division?.teams.find(
        (team) => team.name === fitGame.teamAway,
      );
      const field = tournament.fields.find(
        (item) => item.name === fitGame.field,
      );
      const slot = this.findTimeslot(day, fitGame.timeslot);
      const existingById = existingByFitId.get(fitGame.gameId);
      if (existingById && existingById.dayId !== day.id) {
        plan.errors.push(
          `FIT game ${fitGame.gameId} belongs to another tournament day.`,
        );
        plan.changes.push({
          type: 'Game',
          key: String(fitGame.gameId),
          action: 'Conflict',
          details: 'FIT identifier already belongs to another day',
        });
        continue;
      }
      if (
        !division ||
        !field ||
        !slot ||
        (fitGame.teamHome && !homeTeam) ||
        (fitGame.teamAway && !awayTeam)
      ) {
        plan.errors.push(
          `Cannot resolve references for FIT game ${fitGame.gameId}`,
        );
        plan.changes.push({
          type: 'Game',
          key: String(fitGame.gameId),
          action: 'Conflict',
          details: 'Missing division, team, field or timeslot',
        });
        continue;
      }
      const resolvedSlot = slot;
      const existing =
        existingById ??
        this.fallbackGame(
          existingGames,
          fitGame,
          tournament,
          day,
          resolvedSlot.value,
        );
      if (fitGame.status === 'Deleted') {
        if (existing && this.hasSignificantScore(existing)) {
          plan.warnings.push(
            `FIT game ${fitGame.gameId} is deleted but has a significant score.`,
          );
          plan.changes.push({
            type: 'Game',
            key: String(fitGame.gameId),
            action: 'Keep',
            details: 'score protected',
            warning: true,
          });
        } else if (existing) {
          plan.gameIdsToDelete.push(existing.id);
          plan.changes.push({
            type: 'Game',
            key: String(fitGame.gameId),
            action: 'Delete',
            details: 'FIT marks the game as deleted',
          });
        }
        continue;
      }
      if (existing && this.hasSignificantScore(existing)) {
        touched.add(existing.id);
        plan.warnings.push(
          `FIT game ${fitGame.gameId} has a significant score and was not changed.`,
        );
        plan.changes.push({
          type: 'Game',
          key: String(fitGame.gameId),
          action: 'Keep',
          details: 'score protected',
          warning: true,
        });
        continue;
      }
      const game: Game =
        existing ??
        this.newGame(
          tournament,
          day,
          resolvedSlot.value,
          division.id,
          field.id,
          homeTeam?.id ?? '',
          awayTeam?.id ?? '',
          fitGame.gameId,
        );
      game.fitGameId = fitGame.gameId;
      game.tournamentId = tournament.id;
      game.dayId = day.id;
      game.timeslotId = resolvedSlot.value.id;
      game.fieldId = field.id;
      game.divisionId = division.id;
      game.homeTeamId = homeTeam?.id ?? '';
      game.awayTeamId = awayTeam?.id ?? '';
      game.what = fitGame.gameType;
      touched.add(game.id);
      plan.gamesToSave.push(game);
      plan.changes.push({
        type: 'Game',
        key: String(fitGame.gameId),
        action: existing ? 'Update' : 'Create',
        details: `${existing ? 'Update' : 'Create'} game ${fitGame.gameId}`,
      });
    }
    for (const game of existingGames.filter(
      (item) => item.dayId === day.id && item.fitGameId !== undefined,
    )) {
      if (!touched.has(game.id) && !this.hasSignificantScore(game)) {
        plan.gameIdsToDelete.push(game.id);
        plan.changes.push({
          type: 'Game',
          key: String(game.fitGameId),
          action: 'Delete',
          details: 'FIT game is absent from the imported day',
        });
      }
    }
  }

  /** Assigns chronological numeric day IDs and keeps game references consistent. */
  private renumberDays(
    tournament: Tournament,
    existingGames: Game[],
    previousDayDates: Map<string, string>,
    plan: FitMergePlan,
  ): void {
    const days = [...tournament.days].sort(
      (left, right) => left.date - right.date,
    );
    const idByDate = new Map<string, string>();
    days.forEach((day, index) =>
      idByDate.set(this.dateService.toDate(day.date), String(index + 1)),
    );
    for (const day of days) {
      const date = this.dateService.toDate(day.date);
      const newId = idByDate.get(date)!;
      day.id = newId;
      day.parts.forEach((part, index) => {
        part.id = String(index + 1);
        part.dayId = newId;
      });
    }
    for (const game of existingGames) {
      const date = previousDayDates.get(game.dayId);
      const newDayId = date ? idByDate.get(date) : undefined;
      if (!newDayId) {
        plan.errors.push(
          `Game ${game.id} references a day removed by the FIT structure import.`,
        );
        continue;
      }
      if (game.dayId !== newDayId) {
        const updated = this.clone(game);
        updated.dayId = newDayId;
        plan.gamesToSave.push(updated);
        plan.changes.push({
          type: 'Game',
          key: game.fitGameId?.toString() ?? game.id,
          action: 'Update',
          details: `Update day reference to ${newDayId}`,
        });
      }
    }
  }

  private buildTimeslots(
    fit: FITData,
    date: string,
    times: string[],
    plan: FitMergePlan,
  ): { slotType: SlotType; fitTime?: string }[] {
    const result: { slotType: SlotType; fitTime?: string }[] = [];
    const sorted = [...times].sort();
    for (let index = 0; index < sorted.length; index++) {
      const time = sorted[index];
      const next = sorted[index + 1];
      const required = fit.games.some(
        (game) =>
          game.date === date && game.timeslot === time && game.resultRequired,
      );
      const defaultWithExtra =
        defaultSloTypes.find(
          (slot) =>
            slot.extraTimeDuration > 0 &&
            slot.nbPeriod === defaultSlotType.nbPeriod &&
            slot.periodDuration === defaultSlotType.periodDuration,
        ) ?? defaultSloTypes.find((slot) => slot.extraTimeDuration > 0);
      const duration = next
        ? this.minutesBetween(time, next)
        : required
          ? (defaultWithExtra?.totalDuration ?? defaultSlotType.totalDuration)
          : defaultSlotType.totalDuration;
      const candidates = defaultSloTypes.filter(
        (slot) =>
          slot.playTime > 0 &&
          slot.totalDuration <= duration &&
          (!required || slot.extraTimeDuration > 0),
      );
      const slotType = [...candidates].sort(
        (left, right) => right.totalDuration - left.totalDuration,
      )[0];
      if (!slotType) {
        plan.errors.push(
          `No predefined SlotType can represent ${date} ${time}.`,
        );
        continue;
      }
      result.push({ slotType, fitTime: time });
      let remaining = duration - slotType.totalDuration;
      while (remaining > 0) {
        const breakType = [...defaultSloTypes]
          .filter(
            (slot) => slot.playTime === 0 && slot.totalDuration <= remaining,
          )
          .sort((left, right) => right.totalDuration - left.totalDuration)[0];
        if (!breakType) {
          plan.warnings.push(
            `The remaining ${remaining} minutes after ${date} ${time} cannot be filled exactly with predefined breaks.`,
          );
          break;
        }
        result.push({ slotType: breakType });
        remaining -= breakType.totalDuration;
      }
    }
    return result;
  }

  private minutesBetween(left: string, right: string): number {
    const [leftHour, leftMinute] = left.split(':').map(Number);
    const [rightHour, rightMinute] = right.split(':').map(Number);
    return rightHour * 60 + rightMinute - (leftHour * 60 + leftMinute);
  }

  private findTimeslot(
    day: Day,
    time: string,
  ): { value: Timeslot; part: PartDay } | undefined {
    for (const part of day.parts) {
      const value = part.timeslots.find(
        (slot) => this.dateService.toTime(slot.start) === time,
      );
      if (value) return { value, part };
    }
    return undefined;
  }

  private fallbackGame(
    games: Game[],
    fitGame: FitGame,
    tournament: Tournament,
    day: Day,
    slot: Timeslot,
  ): Game | undefined {
    const division = tournament.divisions.find(
      (item) => item.name === fitGame.division,
    );
    const home = division?.teams.find(
      (team) => team.name === fitGame.teamHome,
    )?.id;
    const away = division?.teams.find(
      (team) => team.name === fitGame.teamAway,
    )?.id;
    return games.find(
      (game) =>
        game.dayId === day.id &&
        game.timeslotId === slot.id &&
        game.divisionId === division?.id &&
        game.homeTeamId === home &&
        game.awayTeamId === away,
    );
  }

  /** Removes duplicate FIT matches while preserving their first occurrence. */
  private uniqueFitGames(games: FitGame[]): FitGame[] {
    const unique = new Map<number, FitGame>();
    for (const game of games) {
      if (!unique.has(game.gameId)) unique.set(game.gameId, game);
    }
    return Array.from(unique.values());
  }

  private divisionName(fit: FITData, name: string): string {
    return (
      fit.renaming.divisions.find((item) => item.fitName === name)?.appName ||
      toCategory(name)
    );
  }

  /** Matches a FIT division with the standard division palette. */
  private findBasicDivision(
    fitName: string,
    finalName: string,
    currentShortName?: string,
  ): (typeof BasicDivisions)[number] | undefined {
    const automaticShortName = toCategory(fitName);
    return BasicDivisions.find(
      (item) =>
        item.shortName === automaticShortName ||
        item.shortName === currentShortName ||
        item.name === finalName ||
        item.name === fitName,
    );
  }

  private findDivision(
    tournament: Tournament,
    fitSlug: string | undefined,
    name: string,
  ): Division | undefined {
    return tournament.divisions.find(
      (item) => (fitSlug && item.fitSlug === fitSlug) || item.name === name,
    );
  }

  private findTeam(
    division: Division,
    divisionSlug: string | undefined,
    fitSlug: string | undefined,
    name: string,
  ): Team | undefined {
    return division.teams.find(
      (item) =>
        (fitSlug &&
          item.fitDivisionSlug === divisionSlug &&
          item.fitSlug === fitSlug) ||
        item.name === name,
    );
  }

  private findOrCreateDay(
    tournament: Tournament,
    date: string,
  ): { value: Day; created: boolean } {
    const existing = tournament.days.find(
      (item) => this.dateService.toDate(item.date) === date,
    );
    if (existing) return { value: existing, created: false };
    const value: Day = {
      id: this.newId('day'),
      date: this.dateService.fromDateStr(date, 'YYYY-MM-DD'),
      parts: [],
    };
    tournament.days.push(value);
    return { value, created: true };
  }

  private firstPart(day: Day): PartDay {
    if (day.parts.length) return day.parts[0];
    const part: PartDay = {
      id: this.newId('part'),
      dayId: day.id,
      timeslots: [],
      allFieldsAvaillable: true,
      availableFieldIds: [],
    };
    day.parts.push(part);
    return part;
  }

  private newDivision(name: string, fitSlug?: string): Division {
    return {
      id: this.newId('division'),
      name,
      shortName: name,
      backgroundColor: '',
      fontColor: '',
      teams: [],
      fitSlug,
    };
  }

  private newTeam(
    name: string,
    divisionName: string,
    fitDivisionSlug?: string,
    fitSlug?: string,
  ): Team {
    return {
      id: this.newId('team'),
      name,
      shortName: name,
      divisionName,
      fitDivisionSlug,
      fitSlug,
    };
  }

  private newField(name: string, orderView: number): Field {
    return {
      id: this.newId('field'),
      name,
      video: false,
      quality: 1,
      orderView,
    };
  }

  private newGame(
    tournament: Tournament,
    day: Day,
    slot: Timeslot,
    divisionId: string,
    fieldId: string,
    homeTeamId: string,
    awayTeamId: string,
    fitGameId: number,
  ): Game {
    return {
      id: '',
      lastChange: Date.now(),
      tournamentId: tournament.id,
      scheduleId: tournament.currentScheduleId ?? '',
      divisionId,
      dayId: day.id,
      timeslotId: slot.id,
      fieldId,
      homeTeamId,
      awayTeamId,
      what: '',
      fitGameId,
    };
  }

  private newId(prefix: string): string {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  private clone<T>(value: T): T {
    return structuredClone(value);
  }
}
