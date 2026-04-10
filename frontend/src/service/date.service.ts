import { Injectable } from '@angular/core';
import {
  addDays,
  addMilliseconds,
  format,
  fromUnixTime,
  getUnixTime,
  parse,
  set,
  startOfDay
} from 'date-fns';

@Injectable({
  providedIn: 'root'
})
/**
 * Provides date conversions and formatting helpers for tournament data.
 * All epoch values handled by this service are Unix timestamps expressed in seconds.
 */
export class DateService {
  private readonly formatAliases: Record<string, string> = {
    'YYYY-MM-DD': 'yyyy-MM-dd',
    'YYYY/MM/DD': 'yyyy/MM/dd',
    'dddd': 'EEEE'
  };

  /** Converts a Unix timestamp in seconds to a JavaScript Date. */
  public epochToDate(epoch: number): Date {
    return fromUnixTime(epoch);
  }

  /** Converts a JavaScript Date to a Unix timestamp in seconds. */
  public dateToEpoch(date: Date): number {
    return getUnixTime(date);
  }

  /** Returns tomorrow at the current local time as a Unix timestamp in seconds. */
  public tomorrow(): number {
    return getUnixTime(addDays(new Date(), 1));
  }

  /** Adds calendar days to a Unix timestamp in seconds. */
  public addDay(epoch: number, nbDay: number): number {
    return getUnixTime(addDays(this.epochToDate(epoch), nbDay));
  }

  /** Adds milliseconds to a Unix timestamp in seconds. */
  public addMilli(epoch: number, nbMilli: number): number {
    return getUnixTime(addMilliseconds(this.epochToDate(epoch), nbMilli));
  }

  /** Sets the hour and minute on a Unix timestamp in seconds. */
  public setTime(epoch: number, h: number, m: number): number {
    return getUnixTime(set(this.epochToDate(epoch), {
      hours: h,
      minutes: m,
      seconds: 0,
      milliseconds: 0
    }));
  }

  /** Formats a Unix timestamp in seconds as a local time string. */
  public toTime(epoch: number): string {
    return format(this.epochToDate(epoch), 'HH:mm');
  }

  public toDuration(epoch: number): string {
    const seconds = Math.floor(epoch / 1000);
    const h = Math.floor(seconds / 3600);
    let rest = seconds % 3600;
    const min = Math.floor(rest / 60);
    rest = rest % 60;
    const sec = rest;
    return (h > 0 ? h + 'h' : '') + (min > 0 ? min + 'min' : '') + (sec > 0 ? sec + 's' : '');
  }

  public fromTime(dayEpoch: number, timeStr: string): number {
    const parts = timeStr.split(':');
    return getUnixTime(set(this.epochToDate(dayEpoch), {
      hours: Number.parseInt(parts[0], 10),
      minutes: Number.parseInt(parts[1], 10),
      seconds: 0,
      milliseconds: 0
    }));
  }

  public toDate(epoch: number): string {
    return this.toDateStr(epoch, 'YYYY-MM-DD');
  }

  public toDateStr(epoch: number, pattern: string): string {
    return this.formatEpoch(epoch, pattern);
  }

  public fromDateStr(dateStr: string, pattern: string): number {
    const parsedDate = parse(dateStr, this.normalizeFormat(pattern), new Date());
    return getUnixTime(parsedDate);
  }

  public toDayOfWeek(epoch: number): string {
    return this.formatEpoch(epoch, 'dddd');
  }

  public to00h00(epoch: number): number {
    return getUnixTime(startOfDay(this.epochToDate(epoch)));
  }

  private formatEpoch(epoch: number, pattern: string): string {
    return format(this.epochToDate(epoch), this.normalizeFormat(pattern));
  }

  private normalizeFormat(pattern: string): string {
    return this.formatAliases[pattern] ?? pattern;
  }
}
