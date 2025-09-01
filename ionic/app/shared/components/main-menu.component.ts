import { Component, inject, OnInit, output, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { TournamentService } from '../services/tournament.service';

@Component({
  standalone: false,
  selector: 'app-main-menu',
  template: `<ion-list>
    <ion-item (click)="route('/home')">Home</ion-item>
    <ion-item (click)="route('/tournament')">Tournaments</ion-item>
    <ion-item-group  *ngIf="selectedTournament() as tournament">
      <ion-item-divider color="light" (click)="route('/tournament/' + selectedTournament()!.id + '/home')">Tournament {{ tournament.name }}</ion-item-divider>
      <div style="padding-left: 20px;">
        <ion-item (click)="route('/tournament/' + selectedTournament()!.id + '/edit')">General</ion-item>
        <ion-item (click)="route('/referee/tournament/' + selectedTournament()!.id + '/referee')">Referees</ion-item>
        <ion-item (click)="route('/referee/tournament/' + selectedTournament()!.id + '/coach')">Referee coaches</ion-item>
        <ion-item (click)="route('/tournament/' + selectedTournament()!.id + '/game')">Games</ion-item>
        <ion-item (click)="route('/referee/tournament/' + selectedTournament()!.id + '/allocation')">Referee Allocations</ion-item>
      </div>
    </ion-item-group>
    <ion-item-group>
      <ion-item-divider color="light">Admin</ion-item-divider>
    </ion-item-group>
  </ion-list>`,
  styles: [''],
})
export class MainMenuComponent {
  router = inject(Router);
  closeMenu = output();

  tournamentService = inject(TournamentService);
  selectedTournament = computed(() => this.tournamentService.currentTournament());

  route(path: string) {
    console.log('Routing to', path);
    this.router.navigate([path]);
    this.closeMenu.emit();
  }
}
