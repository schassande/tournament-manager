import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { TournamentListComponent } from './tournament-list.component';
import { TournamentEditComponent } from './tournament-edit.component';
import { AuthGuard } from '../shared/auth-guard';
import { TournamentHomeComponent } from './tournament-home.component';
import { TournamentGamesComponent } from './tournament-games.component';

const routes: Routes = [
  { path: '',
    component: TournamentListComponent,
    data: { title: 'List of tournaments' }
  }, {
    path: 'create',
    component: TournamentEditComponent,
    data: { title: 'Create tournament'},
    canActivate: [AuthGuard]
  }, {
    path: ':id/home',
    component: TournamentHomeComponent,
    data: { title: 'Tournament home' },
    canActivate: [AuthGuard]
  }, {
    path: ':id/game',
    component: TournamentGamesComponent,
    data: { title: 'Tournament games' },
    canActivate: [AuthGuard]
  }, {
    path: ':id/edit',
    component: TournamentEditComponent,
    data: { title: 'Edit tournament' },
    canActivate: [AuthGuard]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TournamentRoutingModule {}
