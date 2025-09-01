import { TournamentService } from './../service/tournament.service';
import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MainMenuComponent } from '../component/main-menu.component';

@Component({
  selector: 'app-root',
  imports: [
    MainMenuComponent,
    RouterOutlet
    ],
  template: `
    <app-main-menu></app-main-menu>
    <div style="margin-top: 60px;">
      <router-outlet></router-outlet>
    </div>
  `,
  styles: [''],
  standalone: true
})
export class AppComponent implements OnInit {

  tournamentService = inject(TournamentService)

  ngOnInit() {
    this.tournamentService.loadCurrentTournamentFromLocalStorage().subscribe();
  }
}
