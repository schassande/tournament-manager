import { inject, Injectable } from '@angular/core';
import { Referee, RefereeCategory, RefereeCoach, Tournament } from '@tournament-manager/persistent-data-model';
import { forkJoin, map, mergeMap, Observable, of, take } from 'rxjs';
import { AttendeeService } from './attendee.service';
import { PersonService } from './person.service';
import { TournamentService } from './tournament.service';
import { badgeStyle } from './referee-selector.service';

@Injectable({
  providedIn: 'root'
})
export class RefereeService {
  private attendeeService = inject(AttendeeService);
  private personService = inject(PersonService);
  private tournamentService = inject(TournamentService);

  public findReferees(tournament: Tournament): Observable<Referee[]> {
    return this.attendeeService.findTournamentReferees(tournament.id).pipe(
      map(attendees => {
        return attendees.map(attendee => {
          // console.debug('Referee attendee loaded', attendee);
          const referee: Referee = { attendee, isPR: attendee.isReferee && attendee.isPlayer };
          if (attendee.isPlayer) {
            referee.team = this.tournamentService.getTeam(tournament, attendee.player!.teamId);
          }
          return referee;
        });
      })
    )
  }
  public findRefereeCoaches(tournamentId: string): Observable<RefereeCoach[]> {
    return this.attendeeService.findTournamentRefereeCoaches(tournamentId).pipe(
      map(attendees => {
        return attendees.map(attendee => {
          // console.debug('RefereeCoach attendee loaded', attendee);
          const refereeCoach: RefereeCoach = { attendee };
          return refereeCoach;
        });
      })
    )
  }

  /**
   * Parse a level definition (badge, category, upgrade)
   * Supported patterns:
   * [<system prefix>] { <level number> | <category> | '*' } [ ['/'] <system> ]
   * system prefix = 'FIT', 'NZ', 'AU', 'US', 'EUR', 'EU', 'SA', 'SATA', 'AUS'
   * category = RefereeCategory types + 'Open' + 'Junior' + 'Senior' + 'Master'
   * '*' = upgrade
   * @param level : the string to parse
   * @param defaultSystem : the default badge system
   */
  public parseLevel(level: string, defaultSystem:number = 5): ParsedLevel {
    // upcase and trim
    let str = level.trim().toUpperCase();
    // initialize result
    const parsedLevel: ParsedLevel = { badge: 0, system: defaultSystem};
    let defaultSystemUsed = true;
    // working var
    let idx = 0; 

    // Parse and extract system prefix    
    const sytems = [
      { system: 4, keywords: ['FIT', 'NZ', 'AU']},
      { system: 5, keywords: ['US', 'EUR', 'EU', 'SA', 'SATA']},
      { system: 6, keywords: ['AUS']}
    ]
    sytems.find(system => system.keywords.find(key => { 
      idx = str.indexOf(key);
      if (idx >= 0) {
        str = (str.substring(0, idx) + str.substring(idx+key.length, str.length)).trim();
        parsedLevel.system = system.system;
        defaultSystemUsed = false;
        return true; // stop search
      }
      return false;
    }));

    // Remove the L or N prefix of the level
    if (str.length > 0 && (str.at(0) === 'L' || str.at(0) === 'N')) {
      str = str.substring(1).trim();
    }

    // Parse and extract the upgrade status
    idx = str.indexOf('*');
    if (idx >= 0) {
      str = str.substring(0, idx)+str.substring(idx+1, str.length).trim();
      parsedLevel.upgrade = true;
    }

    // Parse and extract the referee category
    const categories: { keyword: string, category: RefereeCategory}[] = [
      {category:'S', keyword: 'S'}, 
      {category:'S', keyword: 'Senior'}, 
      {category:'J', keyword: 'J'},
      {category:'J', keyword: 'Junior'},
      {category:'M', keyword: 'M'},
      {category:'M', keyword: 'Master'},
      {category:'O', keyword: 'O'},
      {category:'O', keyword: 'Open'}
    ] 
    categories.find(c => {
      idx = str.indexOf(c.keyword);
      if (idx >= 0) {
        str = str.substring(0, idx)+str.substring(idx+c.keyword.length, str.length).trim();
        parsedLevel.category = c.category;
        return true; // Stop search
      }
      return false;
    });

    // try the pattern '9/9' first digit is the badge level, second digit is the system
    if (str.length === 3 && str.indexOf('/') === 1) {
      const s = Number.parseInt(str.at(2)!)
      if (!Number.isNaN(s)) {
        parsedLevel.system = Math.max(3, Math.min(s, 6));
      }
      const b = Number.parseInt(str.at(0)!)
      if (!Number.isNaN(s)) {
        parsedLevel.badge = Math.max(0, Math.min(b, parsedLevel.system));
      }
      return parsedLevel;
    }

    // try the pattern '99' first digit is the badge level, second digit is the system
    if (str.length === 2) {
      const b = Number.parseInt(str.at(0)!);
      const s = Number.parseInt(str.at(1)!);
      if (!Number.isNaN(b) && !Number.isNaN(s)) {
        parsedLevel.system = Math.max(3, Math.min(s, 6));
        parsedLevel.badge = Math.max(0, Math.min(b, s));
        return parsedLevel;
      }
    }

    // try to parse the string directly
    const b = Number.parseInt(str);
    if (!Number.isNaN(b)) {
      if (defaultSystemUsed && 0 <= b && b <= 6 && defaultSystem < b) {
        // use the badge a system because it is higher the defaultSytem value
        parsedLevel.system = Math.max(3, Math.min(b, 6));
      }
      parsedLevel.badge = Math.max(0, Math.min(b, parsedLevel.system));
    }

    return parsedLevel;
  }
}
export interface ParsedLevel {
  badge: number;
  system: number;
  upgrade?: boolean;
  category?: RefereeCategory;
}
