import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Attendee } from '@tournament-manager/persistent-data-model';
import { AttendeeService } from '../../service/attendee.service';
import { TournamentHomeResponse, TournamentHomeService } from '../../service/tournament-home.service';
import { UserService } from '../../service/user.service';
import { TournamentService } from '../../service/tournament.service';

interface HomeAction {
  label: string;
  path: string;
}

@Component({
  selector: 'app-tournament-home',
  imports: [CommonModule, RouterLink],
  templateUrl: './tournament-home.page.html',
  styleUrl: './tournament-home.page.css',
})
export class TournamentHomeComponent implements OnInit {
  private readonly tournamentService = inject(TournamentService);
  private readonly homeService = inject(TournamentHomeService);
  private readonly attendeeService = inject(AttendeeService);
  private readonly userService = inject(UserService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly overview = signal<TournamentHomeResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly actions = signal<HomeAction[]>([]);
  readonly sortedDivisions = computed(() =>
    [...(this.overview()?.tournament.divisions ?? [])].sort((left, right) =>
      this.compareDivisions(left.shortName, right.shortName),
    ),
  );
  readonly phase = computed(() => {
    const tournament = this.overview()?.tournament;
    if (!tournament) return 'before';
    const now = Math.floor(Date.now() / 1000);
    return now < tournament.startDate ? 'before' : now <= tournament.endDate ? 'during' : 'after';
  });

  ngOnInit(): void {
    const tournamentId = this.route.snapshot.paramMap.get('tournamentId');
    if (!tournamentId) {
      this.router.navigate(['/tournament']);
      return;
    }
    this.tournamentService
      .byId(tournamentId)
      .subscribe((tournament) => this.tournamentService.setCurrentTournament(tournament ?? null));
    this.homeService.byTournament(tournamentId).subscribe({
      next: (overview) => {
        this.overview.set(overview);
        this.loading.set(false);
        this.loadActions(tournamentId);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  dayStart(day: TournamentHomeResponse['tournament']['days'][number]): number | undefined {
    const values = day.parts.flatMap((part) => part.timeslots.map((timeslot) => timeslot.start));
    return values.length ? Math.min(...values) : undefined;
  }

  dayEnd(day: TournamentHomeResponse['tournament']['days'][number]): number | undefined {
    const values = day.parts.flatMap((part) => part.timeslots.map((timeslot) => timeslot.end));
    return values.length ? Math.max(...values) : undefined;
  }

  /** Converts the application's Unix seconds timestamp to the milliseconds expected by DatePipe. */
  datePipeValue(epoch: number | undefined): number | undefined {
    return epoch === undefined ? undefined : epoch * 1000;
  }

  /** Formats a tournament Unix timestamp in the tournament's configured timezone. */
  formatDate(epoch: number, timeZone: string): string {
    return this.formatInTimeZone(epoch, timeZone, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  /** Formats a tournament Unix timestamp as a local tournament time. */
  formatTime(epoch: number | undefined, timeZone: string): string {
    return epoch === undefined ? '-' : this.formatInTimeZone(epoch, timeZone, { hour: '2-digit', minute: '2-digit' });
  }

  /** Formats a tournament day with its weekday at the beginning. */
  formatDayDate(epoch: number, timeZone: string): string {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    };
    const fixedOffset = /^UTC([+-])(\d{2}):?(\d{2})$/.exec(timeZone);
    const date = new Date(epoch * 1000 + (fixedOffset ? this.offsetMinutes(fixedOffset) * 60_000 : 0));
    const formatter = new Intl.DateTimeFormat('en-US', {
      ...options,
      timeZone: fixedOffset ? 'UTC' : timeZone || 'UTC',
    });
    const parts = formatter.formatToParts(date);
    const value = (type: Intl.DateTimeFormatPartTypes): string => parts.find((part) => part.type === type)?.value ?? '';
    return `${value('weekday')}, ${value('day')}/${value('month')}/${value('year')}`;
  }

  barWidth(total: number): string {
    const maximum = Math.max(
      ...(this.overview()?.pyramid ?? []).flatMap((row) => [row.male.total, row.female.total]),
      1,
    );
    return `${Math.max((total / maximum) * 100, total ? 8 : 0)}%`;
  }

  /** Formats a referee count and omits the upgrade suffix when there is no upgrade. */
  countLabel(total: number, upgrade: number): string {
    return upgrade > 0 ? `${total}(${upgrade})` : `${total}`;
  }

  teamNames(division: TournamentHomeResponse['tournament']['divisions'][number]): string {
    return division.teams.map((team) => team.name).join(', ');
  }

  /** Sorts divisions by category, then by age, with open divisions first in each category. */
  private compareDivisions(leftCode: string, rightCode: string): number {
    const left = this.divisionSortKey(leftCode);
    const right = this.divisionSortKey(rightCode);
    return left[0] - right[0] || left[1] - right[1] || left[2].localeCompare(right[2]);
  }

  /** Builds the ordering key for a division code such as `MO`, `M30`, or `XO`. */
  private divisionSortKey(code: string): [number, number, string] {
    const normalizedCode = (code ?? '').trim().toUpperCase();
    const category = normalizedCode.charAt(0);
    const categoryOrder = category === 'M' ? 0 : category === 'W' ? 1 : category === 'X' ? 2 : 3;
    const age = normalizedCode.endsWith('O') ? 0 : Number.parseInt(normalizedCode.slice(1), 10);
    return [categoryOrder, Number.isNaN(age) ? Number.MAX_SAFE_INTEGER : age, normalizedCode];
  }

  private loadActions(tournamentId: string): void {
    const email = this.userService.currentUser$()?.email;
    if (!email) return;
    this.attendeeService
      .findByEmail(tournamentId, email)
      .subscribe((attendees) => this.actions.set(this.buildActions(attendees)));
  }

  private formatInTimeZone(epoch: number, timeZone: string, options: Intl.DateTimeFormatOptions): string {
    const fixedOffset = /^UTC([+-])(\d{2}):?(\d{2})$/.exec(timeZone);
    if (fixedOffset) {
      return new Intl.DateTimeFormat(undefined, { ...options, timeZone: 'UTC' }).format(
        new Date(epoch * 1000 + this.offsetMinutes(fixedOffset) * 60_000),
      );
    }
    return new Intl.DateTimeFormat(undefined, { ...options, timeZone: timeZone || 'UTC' }).format(
      new Date(epoch * 1000),
    );
  }

  private offsetMinutes(match: RegExpExecArray): number {
    return (Number(match[2]) * 60 + Number(match[3])) * (match[1] === '+' ? 1 : -1);
  }

  private buildActions(attendees: Attendee[]): HomeAction[] {
    const tournament = this.overview()!.tournament;
    const roles = new Set(attendees.flatMap((attendee) => attendee.roles));
    const modules = new Set(tournament.enablesModules ?? []);
    const manager = roles.has('TournamentManager') || roles.has('GameAllocator');
    const coach = roles.has('CoachReferee') || roles.has('RefereeCoachLeader');
    const actions: HomeAction[] = [];
    if (manager) {
      if (modules.has('FIT_IMPORT')) {
        actions.push({ label: 'FIT Import', path: `/tournament/${tournament.id}/fit-import` });
      } else if (modules.has('DRAW_DESIGNER')) {
        actions.push({ label: 'Draw Designer', path: `/tournament/${tournament.id}/draw-designer` });
      }
      actions.push({ label: 'View games list', path: `/tournament/${tournament.id}/game` });
    }
    if (manager || coach) {
      actions.push(
        { label: 'Manage referees', path: `/tournament/${tournament.id}/referee` },
        { label: 'Manage referee Coaches', path: `/tournament/${tournament.id}/coach` },
        { label: 'Allocate referees on games', path: `/tournament/${tournament.id}/allocation` },
      );
    }
    actions.push({ label: 'View referee planning', path: `/tournament/${tournament.id}/referee-planning` });
    if (coach && modules.has('UPGRADE')) {
      actions.push({ label: 'Manage referee upgrades', path: `/tournament/${tournament.id}/referee-upgrade` });
    }
    return actions;
  }
}
