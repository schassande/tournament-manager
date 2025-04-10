import { Tournament } from 'src/app/shared/data.model';
import { TournamentService } from './../../shared/services/tournament.service';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-tournament-home',
  templateUrl: './tournament-home.component.html',
  styleUrls: ['./tournament-home.component.scss'],
  standalone: false
})
export class TournamentHomeComponent  implements OnInit {

  private tournamentService = inject(TournamentService)
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  tournament = signal<Tournament|null>(null);

  ngOnInit() {
    const tournamentId = this.activatedRoute.snapshot.paramMap.get('id') as string;
    if (!tournamentId) {
      console.error('No tournament id in url: ');
      this.router.navigate(['/home']);
      return;
    }
    this.tournamentService.byId(tournamentId).subscribe(t => {
      if (t) {
        console.debug('Tournament: ', t);
        this.tournament.set(t);
        this.tournamentService.setCurrentTournament(t);
      } else {
        console.error('Tournament not found: ', tournamentId, t);
        this.router.navigate(['/home']);
      }
    });
  }
}
