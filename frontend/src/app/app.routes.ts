import { Routes } from '@angular/router';
import { HomeComponent } from '../page/home.page';
import { UserLoginComponent } from '../page/user-login.page';
import UserCreateComponent from '../page/user-create.page';
import { TournamentRefereeComponent } from '../page/tournament-referee.page';
import { AuthGuard } from './auth-guard';
import { TournamentListComponent } from '../page/tournament-list.page';
import { TournamentHomeComponent } from '../page/tournament-home.page';
import { TournamentEditComponent } from '../page/tournament-edit.page';
import { TournamentGamesComponent } from '../page/tournament-games.page';
import { TournamentRefereesAllocationsComponent } from '../page/tournament-referees-allocations.page';
import { TournamentRefereesAllocationComponent } from '../page/tournament-referees-allocation.page';
import { TournamentRefereeCoachComponent } from '../page/tournament-referee-coach.page';

export const routes: Routes = [
  { path: 'home',        component: HomeComponent , data: { title: 'Home' }, pathMatch: 'full'},

  { path: 'user/login',  component: UserLoginComponent , data: { title: 'Login' }, pathMatch: 'full'},
  { path: 'user/create', component: UserCreateComponent, data: { title: 'Create an account' }, pathMatch: 'full'},

  { path: 'tournament', component: TournamentListComponent, data: { title: 'List of tournaments' }},
  { path: 'tournament/create', component: TournamentEditComponent, data: { title: 'Create tournament'}, canActivate: [AuthGuard] },
  { path: 'tournament/:tournamentId/home', component: TournamentHomeComponent, data: { title: 'Tournament home' }},
  { path: 'tournament/:tournamentId/edit', component: TournamentEditComponent, data: { title: 'Edit tournament' }, canActivate: [AuthGuard]},
  { path: 'tournament/:tournamentId/referee', component: TournamentRefereeComponent, data: { title: 'Referees of the tournament' }, canActivate: [AuthGuard],  pathMatch: 'full' },
  { path: 'tournament/:tournamentId/coach', component: TournamentRefereeCoachComponent, data: { title: 'Referee Coaches of the tournament' }, canActivate: [AuthGuard] },
  { path: 'tournament/:tournamentId/game', component: TournamentGamesComponent, data: { title: 'Tournament games' }, canActivate: [AuthGuard] },
  { path: 'tournament/:tournamentId/allocation', component: TournamentRefereesAllocationsComponent, data: { title: 'Referees & Coaches Allocations' }, canActivate: [AuthGuard]},
  { path: 'tournament/:tournamentId/allocation/:tournamentAllocationId/fragment/:fragmentAllocationId', component: TournamentRefereesAllocationComponent, data: { title: 'Referees & Coaches Allocation' }, canActivate: [AuthGuard] },

  { path: '',           redirectTo: '/home', pathMatch: 'full' }
];
