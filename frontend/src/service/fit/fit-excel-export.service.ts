import * as XLSX from 'xlsx';
import { Injectable } from '@angular/core';
import { FITData, FitGame } from './fit-import.service';

const GAME_HEADERS = [
  'Time',
  'Field',
  'Division',
  'Type',
  'Home',
  'Away',
  'Status',
  'FIT id',
  'Changes',
] as const;

/** Generates and downloads an Excel workbook for the currently displayed FIT data. */
@Injectable({ providedIn: 'root' })
export class FitExcelExportService {
  /** Downloads the workbook representing the supplied FIT snapshot. */
  download(data: FITData, competitionName: string): void {
    const workbook = XLSX.utils.book_new();
    this.appendDivisionsSheet(workbook, data);
    this.appendTimeslotsSheet(workbook, data);

    const days = [...data.days].sort((left, right) =>
      left.date.localeCompare(right.date),
    );
    days.forEach((day, index) => {
      this.appendGamesSheet(workbook, `Day ${index + 1}`, this.gamesForDay(data.games, day.date));
    });
    this.appendGamesSheet(workbook, 'Unassigned', this.unassignedGames(data.games));

    XLSX.writeFile(workbook, this.fileName(competitionName, data.importDate));
  }

  private appendDivisionsSheet(workbook: XLSX.WorkBook, data: FITData): void {
    const divisions = data.divisions;
    const rowCount = Math.max(0, ...divisions.map((division) => division.teams.length));
    const rows = [
      divisions.map((division) => division.name),
      ...Array.from({ length: rowCount }, (_, rowIndex) =>
        divisions.map((division) => division.teams[rowIndex]?.name ?? ''),
      ),
    ];
    this.appendSheet(workbook, 'Divisions', rows, divisions.length);
  }

  private appendTimeslotsSheet(workbook: XLSX.WorkBook, data: FITData): void {
    const days = [...data.days].sort((left, right) =>
      left.date.localeCompare(right.date),
    );
    const rowCount = Math.max(0, ...days.map((day) => day.timeslots.length));
    const rows = [
      days.map((day) => day.date),
      ...Array.from({ length: rowCount }, (_, rowIndex) =>
        days.map((day) => day.timeslots[rowIndex] ?? ''),
      ),
    ];
    this.appendSheet(workbook, 'Timeslots', rows, days.length);
  }

  private appendGamesSheet(
    workbook: XLSX.WorkBook,
    name: string,
    games: FitGame[],
  ): void {
    const rows = [
      [...GAME_HEADERS],
      ...games.map((game) => [
        game.timeslot,
        game.field,
        game.division,
        game.gameType,
        game.teamHome,
        game.teamAway,
        `${game.status}${game.washout ? ' (washout)' : ''}`,
        game.gameId,
        game.changes.join(', '),
      ]),
    ];
    this.appendSheet(workbook, name, rows, GAME_HEADERS.length);
  }

  private appendSheet(
    workbook: XLSX.WorkBook,
    name: string,
    rows: unknown[][],
    columnCount: number,
  ): void {
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet['!freeze'] = { xSplit: 0, ySplit: 1 };
    sheet['!autofilter'] = {
      ref: `A1:${this.columnName(columnCount)}${Math.max(1, rows.length)}`,
    };
    sheet['!cols'] = Array.from({ length: columnCount }, (_, columnIndex) => ({
      wch: Math.min(40, Math.max(10, this.maxColumnWidth(rows, columnIndex))),
    }));
    const headerRange = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1');
    for (let columnIndex = headerRange.s.c; columnIndex <= headerRange.e.c; columnIndex++) {
      const cell = sheet[XLSX.utils.encode_cell({ r: 0, c: columnIndex })];
      if (cell) cell.s = { font: { bold: true } };
    }
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  }

  private maxColumnWidth(rows: unknown[][], columnIndex: number): number {
    return Math.max(
      ...rows.map((row) => String(row[columnIndex] ?? '').length),
    );
  }

  private columnName(columnCount: number): string {
    let value = columnCount;
    let name = '';
    while (value > 0) {
      const remainder = (value - 1) % 26;
      name = String.fromCharCode(65 + remainder) + name;
      value = Math.floor((value - 1) / 26);
    }
    return name;
  }

  private gamesForDay(games: FitGame[], date: string): FitGame[] {
    return games
      .filter((game) => game.date === date)
      .sort(
        (left, right) =>
          left.timeslot.localeCompare(right.timeslot) ||
          left.field.localeCompare(right.field) ||
          left.gameId - right.gameId,
      );
  }

  private unassignedGames(games: FitGame[]): FitGame[] {
    return games.filter((game) => !game.date);
  }

  private fileName(competitionName: string, importDate: string): string {
    const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(
      importDate,
    );
    const date = match
      ? `${match[1]}_${match[2]}${match[3]}${match[4]}`
      : importDate.replace(/[<>:"/\\|?*]/g, '_');
    const safeName = competitionName.replace(/[<>:"/\\|?*]/g, '_').trim();
    return `${safeName || 'FIT'}-${date}.xlsx`;
  }
}
