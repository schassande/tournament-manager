import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { map, Observable } from 'rxjs';
import { Tournament } from '@tournament-manager/persistent-data-model';
import { DateService } from '../service/date.service';
import { RegionService } from '../service/region.service';
import { TournamentService } from '../service/tournament.service';

@Component({
  standalone: true,
  selector: 'app-home',
  imports: [AsyncPipe, RouterLink],
  template: `
    <div class="home-logo-container">
      <img
        src="icons/logo/touch_tournament_manager_logo_without_title.png"
        alt="Touch Tournament Manager"
        class="home-logo"
      />
    </div>
    <div class="home-content">
      <p>
        Touch Tournament Manager lets you create and manage tournaments, organize games and fields, manage referees
        and coaches, and plan and track assignments.
      </p>
    </div>
    <section class="public-tournaments" aria-labelledby="public-tournaments-title">
      <h2 id="public-tournaments-title">Recent and next Public tournaments</h2>
      @if (publicTournaments | async; as tournaments) {
        @if (tournaments.length > 0) {
          <div class="tournament-list">
            @for (tournament of tournaments; track tournament.id) {
              <article class="tournament-card">
                <span>{{ tournament.startDateLabel }} – {{ tournament.endDateLabel }}</span>
                <a [routerLink]="['/tournament', tournament.id, 'home']">{{ tournament.name }}</a>
                <span>{{ tournament.countryLabel }}</span>
                <span>{{ tournament.cityLabel }}</span>
              </article>
            }
          </div>
        } @else {
          <p>No tournaments found for the previous, current or next month.</p>
        }
      }
    </section>
  `,
  styles: [
    `
      .home-logo-container {
        text-align: center;
      }

      .home-logo {
        height: 300px;
        width: auto;
      }

      .home-content {
        margin: 1rem auto;
        max-width: 800px;
      }

      .home-logo-title {
        font-size: 1.5rem;
        font-weight: bold;
      }

      .public-tournaments {
        margin: 2rem auto;
        max-width: 1000px;
      }

      .tournament-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .tournament-card {
        align-items: center;
        border: 1px solid var(--p-surface-300);
        border-radius: 8px;
        display: grid;
        gap: 1rem;
        grid-template-columns: 180px minmax(180px, 1fr) 160px minmax(140px, 1fr);
        padding: 1rem;
        text-align: left;
      }
    `,
  ],
})
/** Displays the application logo on the home page. */
export class HomeComponent {
  private readonly tournamentService = inject(TournamentService);
  private readonly dateService = inject(DateService);
  private readonly regionService = inject(RegionService);

  /** Public tournaments whose start date falls in the previous, current or next calendar month. */
  readonly publicTournaments: Observable<PublicTournamentView[]> = this.loadPublicTournaments();

  /** Loads only the tournaments in the three-month display period and formats them for the template. */
  private loadPublicTournaments(): Observable<PublicTournamentView[]> {
    const currentDate = new Date();
    const firstDayOfPreviousMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() - 1,
      1,
    );
    const firstDayAfterNextMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 2,
      1,
    );
    const periodStart = this.dateService.dateToEpoch(firstDayOfPreviousMonth);
    const periodEnd = this.dateService.dateToEpoch(firstDayAfterNextMonth);

    return this.tournamentService.byStartDateRange(periodStart, periodEnd).pipe(
      map((tournaments) => tournaments.map((tournament) => ({
        ...tournament,
        startDateLabel: this.dateService.toDateStr(tournament.startDate, 'YYYY/MM/DD'),
        endDateLabel: this.dateService.toDateStr(tournament.endDate, 'YYYY/MM/DD'),
        countryLabel: this.regionService.countryById(tournament.countryId)?.name ?? '',
        cityLabel: tournament.city ?? '',
      }))),
    );
  }
}

/** Tournament data formatted for display on the public home page. */
export interface PublicTournamentView extends Tournament {
  startDateLabel: string;
  endDateLabel: string;
  countryLabel: string;
  cityLabel: string;
}
