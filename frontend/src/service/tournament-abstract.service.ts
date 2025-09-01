import { computed, inject } from "@angular/core";
import { TournamentService } from "./tournament.service";
import { Tournament } from "../data.model";
import { Router } from "@angular/router";

export abstract class AbstractTournamentPage {

  protected tournamentService = inject(TournamentService)
  router = inject(Router);

  tournament = computed<Tournament|null>(() => this.tournamentService.currentTournament());

  protected checkHasTournament(): boolean {
    if (this.tournament()) {
      console.log('Tournament found');
      return true;
    } else {
      console.log('No tournament selected, redirecting to home page');
      this.router.navigate(['/home']);
      return false;
    }
  }

  onTournamentConfigChanged() {
    this.tournamentService.save(this.tournament()!).subscribe();
  }
}
