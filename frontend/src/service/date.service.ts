import { Injectable } from '@angular/core';
import dayjs from 'dayjs'

@Injectable({
  providedIn: 'root'
})
export class DateService {

  public epochToDate(epoch: number): Date {
    return dayjs.unix(epoch).toDate();
  }
  public dateToEpoch(date: Date): number {
    return dayjs(date).unix();
  }
  public tomorrow(): number {
    return dayjs().add(1, 'day').unix();
  }
  public addDay(epoch:number, nbDay: number): number {
    return dayjs.unix(epoch).add(nbDay, 'day').unix();
  }
  public addMilli(epoch:number, nbMilli: number): number {
    return dayjs.unix(epoch).add(nbMilli, 'millisecond').unix();
  }
  public setTime(epoch:number, h:number, m:number): number {
    return dayjs.unix(epoch).set('hours', h).set('minutes', m).unix();
  }
  public toTime(epoch: number):string {
    //TODO use this.tournament?.timeZone
    return dayjs.unix(epoch).format('HH:mm');
  }
  public toDuration(epoch: number):string {
    const seconds = Math.floor(epoch / 1000);
    const h = Math.floor(seconds / 3600);
    let rest = seconds % 3600;
    const min =  Math.floor(rest / 60);
    rest = rest % 60;
    const sec = rest;
    return (h > 0 ? h + 'h':'') + (min > 0 ? min + 'min' : '') + (sec > 0 ? sec + 's' : '');
  }
  public fromTime(dayEpoch: number, timeStr: string): number {
    const parts = timeStr.split(':')
    return dayjs.unix(dayEpoch)
      .set('hour', Number.parseInt(parts[0]))
      .set('minute', Number.parseInt(parts[1]))
      .set('second', 0)
      .set('millisecond', 0)
      .unix();
  }
  public toDate(epoch: number):string {
    return this.toDateStr(epoch, 'YYYY-MM-DD');
  }
  public toDateStr(epoch: number, format: string):string {
    //TODO use this.tournament?.timeZone
    return dayjs.unix(epoch).format(format);
  }
  public fromDateStr(dateStr: string, format: string):number {
    //TODO use this.tournament?.timeZone
    return dayjs(dateStr, format).unix();
  }
  public toDayOfWeek(epoch: number):string {
    //TODO use this.tournament?.timeZone
    return dayjs.unix(epoch).format('dddd');
  }
  public to00h00(epoch: number):number {
    return dayjs.unix(epoch).set('hour', 0).set('minute', 0).set('second', 0).set('millisecond', 0).unix();
  }
}
