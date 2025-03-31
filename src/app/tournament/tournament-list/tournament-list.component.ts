import { Observable } from 'rxjs';
import { Tournament } from './../../shared/data.model';
import { TournamentService } from './../../shared/services/tournament.service';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  standalone: false,
  selector: 'app-tournament-list',
  templateUrl: './tournament-list.component.html',
  styleUrls: ['./tournament-list.component.scss'],
})
export class TournamentListComponent {

  private tournamentService = inject(TournamentService);
  private router = inject(Router);

  tournaments: Observable<Tournament[]> = this.tournamentService.all();

  createTournament() {
    this.router.navigate(['/tournament/create']);
  }
}
