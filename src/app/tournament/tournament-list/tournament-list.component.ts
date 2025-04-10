import { RegionService } from 'src/app/shared/services/region.service';
import { map, Observable } from 'rxjs';
import { Country, Region, Tournament } from './../../shared/data.model';
import { TournamentService } from './../../shared/services/tournament.service';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DateService } from 'src/app/shared/services/date.service';

@Component({
  standalone: false,
  selector: 'app-tournament-list',
  templateUrl: './tournament-list.component.html',
  styleUrls: ['./tournament-list.component.scss'],
})
export class TournamentListComponent {

  private tournamentService = inject(TournamentService);
  private router = inject(Router);
  dateService = inject(DateService);
  regionService = inject(RegionService);
  selectedTournament: Tournament|undefined = undefined;

  tournaments: Observable<TournamentView[]> = this.tournamentService.all().pipe(
    map((tournaments: Tournament[]) => {
      return tournaments.map((tournament: Tournament) => {
        const tv: TournamentView = {...tournament,
          startDateStr: this.dateService.toDateStr(tournament.startDate, 'YYYY/MM/DD'),
          endDateStr: this.dateService.toDateStr(tournament.endDate, 'YYYY/MM/DD'),
          region: this.regionService.regionById(tournament.regionId),
          country: this.regionService.countryById(tournament.countryId)
        };
        return tv;
      });
    })
  );

  createTournament() {
    this.router.navigate(['/tournament/create']);
  }

  onTournamentSelected() {
    if (this.selectedTournament) {
      this.router.navigate(['/tournament', this.selectedTournament.id, 'home']);
    }
  }

  editTournament(tournament: Tournament) {
    this.router.navigate(['/tournament', tournament.id, 'edit']);
  }
}

export interface TournamentView extends Tournament {
  startDateStr: string;
  endDateStr: string;
  region: Region|undefined;
  country: Country|undefined;
}
