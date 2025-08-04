import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { TournamentRefereeComponent } from './tournament-referee.component';
import { TournamentRefereeCoachComponent } from './tournament-referee-coach.component';
import { TournamentRefereesAllocationComponent } from './allocation/tournament-referees-allocation.component';
import { TournamentRefereesAllocationsComponent } from './allocation/tournament-referees-allocations.components';
import { AuthGuard } from '../shared/auth-guard';

const routes: Routes = [
  {
    path: 'tournament/:tournamnentId/coach',
    component: TournamentRefereeCoachComponent,
    data: { title: 'Referee Coaches of the tournament' },
    canActivate: [AuthGuard]
  }, {
    path: 'tournament/:tournamnentId/referee',
    component: TournamentRefereeComponent,
    data: { title: 'Referees of the tournament' },
    canActivate: [AuthGuard]
  }, {
    path: 'tournament/:tournamnentId/allocation',
    component: TournamentRefereesAllocationsComponent,
    data: { title: 'Referees Allocations' },
    canActivate: [AuthGuard]
  }, {
    path: 'tournament/:tournamnentId/allocation/:allocationId',
    component: TournamentRefereesAllocationComponent,
    data: { title: 'Referees Allocation' },
    canActivate: [AuthGuard]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class RefereeRoutingModule {}
