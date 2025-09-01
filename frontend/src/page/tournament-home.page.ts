import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Tournament } from '../data.model';
import { TournamentService } from '../service/tournament.service';

@Component({
  selector: 'app-tournament-home',
  template: `
  <div>
    @if (tournament()) {
      <div style="margin: 20px; text-align: center;">
        {{ tournament()!.name }}
      </div>
    }
    <div style="height: 100px;"></div>
  </div>
  `,
  styles: [`
  `],
  standalone: false
})
export class TournamentHomeComponent  implements OnInit {

  private tournamentService = inject(TournamentService)
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  tournament = signal<Tournament|null>(null);

  ngOnInit() {
    const tournamentId = this.activatedRoute.snapshot.paramMap.get('tournamentId') as string;
    if (!tournamentId) {
      console.error('No tournament id in url: ', this.activatedRoute.snapshot.url, tournamentId);
      this.router.navigate(['/tournament']);
      return;
    }
    this.tournamentService.byId(tournamentId).subscribe(t => {
      if (t) {
        // console.debug('Tournament: ', t);
        this.tournament.set(t);
        this.tournamentService.setCurrentTournament(t);
      } else {
        console.error('Tournament not found: ', tournamentId, t);
        this.router.navigate(['/tournament']);
      }
    });
  }
}
