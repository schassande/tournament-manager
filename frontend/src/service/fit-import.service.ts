import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  FitRenamingConfig,
  PersistentObject,
  Tournament,
} from '@tournament-manager/persistent-data-model';
import { environment } from '../environments/environment';

const FIT_API = `${environment.functionsApiUrl}/fitImport`;

export interface FitReference {
  title: string;
  slug: string;
  url?: string;
}
export interface FitCompetition extends FitReference {}
export interface FitSeason extends FitReference {
  divisions: FitReference[];
}
export interface FitTeam {
  id: number;
  title?: string;
  slug?: string;
  club?: {
    title?: string;
    short_title?: string;
    slug?: string;
    abbreviation?: string;
  } | null;
}
export interface FitMatch {
  id: number;
  round?: string;
  date?: string;
  time?: string;
  datetime?: string;
  is_bye?: boolean;
  is_washout?: boolean;
  home_team?: number | null;
  away_team?: number | null;
  play_at?: { title?: string; timezone?: string } | null;
}
export interface FitStage {
  matches?: FitMatch[];
  url?: string;
}
export interface FitDivision extends FitReference {
  teams?: FitTeam[];
  stages?: FitStage[];
}
interface FitDownloadResponse {
  season: FitSeason;
  divisions: FitDivision[];
  excludedByes: number;
}

export type FitGameStatus = 'New' | 'Update' | 'Equal' | 'Deleted';
export interface FitGame {
  date?: string;
  timeslot: string;
  /** Original FIT field name, retained for the field-renaming editor. */
  fitField?: string;
  field: string;
  division: string;
  gameType: string;
  resultRequired: boolean;
  teamHome: string;
  teamAway: string;
  status: FitGameStatus;
  gameId: number;
  changes: string[];
  incomplete: boolean;
  washout: boolean;
  fitDivisionSlug?: string;
  fitHomeTeamSlug?: string;
  fitAwayTeamSlug?: string;
}
export interface FITData extends PersistentObject {
  tournamentId: string;
  importDate: string;
  competitionSlug: string;
  season: string;
  targetTimeZone: string;
  renaming: FitRenamingConfig;
  divisions: {
    name: string;
    fitSlug?: string;
    teams: { name: string; fitSlug?: string; fitId?: number }[];
  }[];
  days: { date: string; timeslots: string[] }[];
  games: FitGame[];
  excludedByes: number;
  unresolvedTeams: number[];
  incompleteGames: number[];
}

/** Converts a FIT division label to the compact tournament-manager label. */
export function toCategory(text: string): string {
  const prefix = text.includes('Women')
    ? 'W'
    : text.includes('Men')
      ? 'M'
      : text.includes('Mixed')
        ? 'X'
        : text.includes('Boy')
          ? 'B'
          : text.includes('Girl')
            ? 'G'
            : '?';
  if (text.includes(' Open')) return prefix + 'O';
  const age = Number.parseInt(text.slice(-2), 10);
  return prefix + (age || '?');
}

/** Selects and formats the preferred FIT team name. */
export function getTeamName(team: FitTeam, capitalize: boolean): string {
  let name = !team.club && team.title ? team.title : team.club?.abbreviation;
  if (name && team.club?.abbreviation && team.club.slug) {
    const numbers = team.club.slug.match(/\d+/g);
    if (numbers) name += numbers.join('');
  }
  name ??=
    team.club?.slug ??
    team.club?.short_title ??
    team.club?.title ??
    team.title ??
    '';
  return capitalize
    ? name.toUpperCase()
    : name.charAt(0).toUpperCase() + name.substring(1).toLowerCase();
}

/** Provides the typed read-only FIT API workflow used by the import page. */
@Injectable({ providedIn: 'root' })
export class FitImportService {
  private readonly http = inject(HttpClient);

  competitions(): Observable<FitCompetition[]> {
    return this.get<FitCompetition[]>('/competitions');
  }
  seasons(competitionSlug: string): Observable<FitReference[]> {
    return this.get<FitReference[]>(
      `/competitions/${encodeURIComponent(competitionSlug)}/seasons`,
    );
  }

  load(
    competitionSlug: string,
    season: string,
    tournament: Tournament,
    renaming: FitRenamingConfig,
    targetTimeZone: string,
  ): Observable<FITData> {
    return this.get<FitDownloadResponse>(
      `/download?competitionSlug=${encodeURIComponent(competitionSlug)}&season=${encodeURIComponent(season)}`,
    ).pipe(
      map((download) =>
        this.buildData(
          tournament,
          competitionSlug,
          season,
          renaming,
          download.divisions,
          targetTimeZone,
          download.excludedByes,
        ),
      ),
    );
  }

  private get<T>(path: string): Observable<T> {
    return this.http
      .get<T>(`${FIT_API}${path}`)
      .pipe(
        catchError((error: HttpErrorResponse) =>
          throwError(
            () =>
              new Error(
                `FIT request failed (${error.status || 'network error'}).`,
              ),
          ),
        ),
      );
  }

  private buildData(
    tournament: Tournament,
    competition: string,
    season: string,
    config: FitRenamingConfig,
    divisions: FitDivision[],
    targetTimeZone: string,
    excludedByes = 0,
  ): FITData {
    const divisionNames = new Map(
      config.divisions.map((item) => [item.fitName, item.appName]),
    );
    const fieldNames = new Map(
      config.fields.map((item) => [item.fitName, item.appName]),
    );
    const games: FitGame[] = [];
    const unresolvedTeams: number[] = [];
    const incompleteGames: number[] = [];
    for (const division of divisions) {
      const teams = new Map((division.teams ?? []).map((team) => [team.id, team]));
      for (const stage of division.stages ?? [])
        for (const match of stage.matches ?? []) {
          if (match.is_bye) {
            continue;
          }
          const homeTeam = match.home_team == null ? undefined : teams.get(match.home_team);
          const awayTeam = match.away_team == null ? undefined : teams.get(match.away_team);
          const home = homeTeam ? this.renamedTeam(homeTeam, config) : '';
          const away = awayTeam ? this.renamedTeam(awayTeam, config) : '';
          if (match.home_team != null && !home)
            unresolvedTeams.push(match.home_team);
          if (match.away_team != null && !away)
            unresolvedTeams.push(match.away_team);
          const rawDivision = division.title;
          const rawField = match.play_at?.title ?? '';
          const dateTime = this.dateTime(match, targetTimeZone);
          const gameType = /^Round(?:\s|$)|^\d/.test(match.round ?? '')
            ? 'Pool'
            : (match.round ?? '');
          const game: FitGame = {
            ...(dateTime.date !== undefined ? { date: dateTime.date } : {}),
            timeslot: dateTime.time,
            fitField: rawField,
            field: fieldNames.get(rawField) || rawField,
            division: divisionNames.get(rawDivision) || toCategory(rawDivision),
            gameType,
            resultRequired: gameType !== 'Pool',
            teamHome: home,
            teamAway: away,
            status: 'New',
            gameId: match.id,
            changes: [],
            incomplete:
              !dateTime.date || !dateTime.time || !rawField || !home || !away,
            washout: match.is_washout === true,
            ...(division.slug !== undefined
              ? { fitDivisionSlug: division.slug }
              : {}),
            ...(homeTeam?.slug !== undefined
              ? { fitHomeTeamSlug: homeTeam.slug }
              : {}),
            ...(awayTeam?.slug !== undefined
              ? { fitAwayTeamSlug: awayTeam.slug }
              : {}),
          };
          if (game.incomplete) incompleteGames.push(match.id);
          games.push(game);
        }
    }
    const names = divisions.map((division) => ({
      name: division.title,
      ...(division.slug !== undefined ? { fitSlug: division.slug } : {}),
      teams: this.teamsReferencedBy(division, config),
    }));
    const dates = Array.from(
      new Set(
        games.map((game) => game.date).filter((date): date is string => !!date),
      ),
    ).sort();
    return {
      id: '',
      lastChange: 0,
      tournamentId: tournament.id,
      importDate: new Date().toISOString(),
      competitionSlug: competition,
      season,
      targetTimeZone,
      renaming: config,
      divisions: names,
      days: dates.map((date) => ({
        date,
        timeslots: Array.from(
          new Set(
            games
              .filter((game) => game.date === date && game.timeslot)
              .map((game) => game.timeslot),
          ),
        ).sort(),
      })),
      games,
      excludedByes,
      unresolvedTeams: Array.from(new Set(unresolvedTeams)),
      incompleteGames,
    };
  }

  private dateTime(
    match: FitMatch,
    timeZone: string,
  ): { date?: string; time: string } {
    if (match.datetime) {
      const instant = new Date(match.datetime);
      const fixedOffset = this.parseUtcOffset(timeZone);
      if (fixedOffset !== undefined) {
        return this.formatWithOffset(instant, fixedOffset);
      }
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(new Date(match.datetime));
      const value = Object.fromEntries(
        parts.map((part) => [part.type, part.value]),
      );
      return {
        date: `${value['year']}-${value['month']}-${value['day']}`,
        time: `${value['hour']}:${value['minute']}`,
      };
    }
    return { date: match.date, time: match.time?.slice(0, 5) ?? '' };
  }

  /** Parses the fixed-offset notation used by the tournament editor. */
  private parseUtcOffset(timeZone: string): number | undefined {
    if (timeZone === 'UTC' || timeZone === 'GMT') return 0;
    const match = /^UTC([+-])(\d{2}):?(\d{2})$/.exec(timeZone);
    if (!match) return undefined;
    const minutes = Number(match[2]) * 60 + Number(match[3]);
    return match[1] === '+' ? minutes : -minutes;
  }

  /** Formats an instant in a fixed UTC offset without relying on Intl time-zone names. */
  private formatWithOffset(
    instant: Date,
    offsetMinutes: number,
  ): { date: string; time: string } {
    const shifted = new Date(instant.getTime() + offsetMinutes * 60_000);
    const pad = (value: number): string => String(value).padStart(2, '0');
    return {
      date: `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`,
      time: `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`,
    };
  }

  private teamsReferencedBy(
    division: FitDivision,
    config: FitRenamingConfig,
  ): { name: string; fitSlug?: string; fitId?: number }[] {
    const names = (division.teams ?? []).map((team) => ({
      name: this.renamedTeam(team, config),
      ...(team.slug !== undefined ? { fitSlug: team.slug } : {}),
      fitId: team.id,
    }));
    return Array.from(
      new Map(names.map((team) => [`${team.fitId ?? ''}:${team.name}`, team])).values(),
    ).sort((left, right) => left.name.localeCompare(right.name));
  }

  private renamedTeam(team: FitTeam, config: FitRenamingConfig): string {
    const fitName = getTeamName(team, config.capitalizeTeamName);
    return (
      config.teams.find((item) => item.fitName === fitName)?.appName || fitName
    );
  }
}
