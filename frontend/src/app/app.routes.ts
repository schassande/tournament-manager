import { Routes } from '@angular/router';
import { AuthGuard } from './auth-guard';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('../page/home.page').then((m) => m.HomeComponent),
    data: { title: 'Home' },
    pathMatch: 'full'
  },

  {
    path: 'user/login',
    loadComponent: () => import('../page/user-login.page').then((m) => m.UserLoginComponent),
    data: { title: 'Login' },
    pathMatch: 'full'
  },
  {
    path: 'user/create',
    loadComponent: () => import('../page/user-create.page').then((m) => m.default),
    data: { title: 'Create an account' },
    pathMatch: 'full'
  },

  {
    path: 'tournament',
    loadComponent: () => import('../page/tournament-list.page').then((m) => m.TournamentListComponent),
    data: { title: 'List of tournaments' }
  },
  {
    path: 'tournament/create',
    loadComponent: () => import('../page/tournament-edit.page').then((m) => m.TournamentEditComponent),
    data: { title: 'Create tournament' },
    canActivate: [AuthGuard]
  },
  {
    path: 'tournament/:tournamentId/home',
    loadComponent: () => import('../page/tournament-home.page').then((m) => m.TournamentHomeComponent),
    data: { title: 'Tournament home' }
  },
  {
    path: 'tournament/:tournamentId/edit',
    loadComponent: () => import('../page/tournament-edit.page').then((m) => m.TournamentEditComponent),
    data: { title: 'Edit tournament' },
    canActivate: [AuthGuard]
  },
  {
    path: 'tournament/:tournamentId/referee',
    loadComponent: () => import('../page/tournament-referee.page').then((m) => m.TournamentRefereeComponent),
    data: { title: 'Referees of the tournament' },
    canActivate: [AuthGuard],
    pathMatch: 'full'
  },
  {
    path: 'tournament/:tournamentId/coach',
    loadComponent: () => import('../page/tournament-referee-coach.page').then((m) => m.TournamentRefereeCoachComponent),
    data: { title: 'Referee Coaches of the tournament' },
    canActivate: [AuthGuard]
  },
  {
    path: 'tournament/:tournamentId/game',
    loadComponent: () => import('../page/tournament-games.page').then((m) => m.TournamentGamesComponent),
    data: { title: 'Tournament games' },
    canActivate: [AuthGuard]
  },
  {
    path: 'tournament/:tournamentId/allocation',
    loadComponent: () => import('../page/tournament-referees-allocations.page').then((m) => m.TournamentRefereesAllocationsComponent),
    data: { title: 'Referees & Coaches Allocations' },
    canActivate: [AuthGuard]
  },
  {
    path: 'tournament/:tournamentId/allocation/:tournamentAllocationId/fragment/:fragmentAllocationId',
    loadComponent: () => import('../page/tournament-referees-allocation.page').then((m) => m.TournamentRefereesAllocationComponent),
    data: { title: 'Referees & Coaches Allocation' },
    canActivate: [AuthGuard]
  },

  { path: '',           redirectTo: '/home', pathMatch: 'full' }
];
