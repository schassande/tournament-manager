import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { TournamentRefereeComponent } from './tournament-referee.component';
import { TournamentRefereeCoachComponent } from './tournament-referee-coach.component';

const routes: Routes = [
  { path: 'tournament/:tournamnentId/referee',           component: TournamentRefereeComponent, data: { title: 'Referees of the tournament' }},
  { path: 'tournament/:tournamnentId/coach',           component: TournamentRefereeCoachComponent, data: { title: 'Referees of the tournament' }},
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class RefereeRoutingModule {}
