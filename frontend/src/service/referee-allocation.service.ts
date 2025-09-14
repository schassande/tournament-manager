import { inject, Injectable } from '@angular/core';
import { forkJoin, from, Observable, of } from 'rxjs';
import { FragmentRefereeAllocation, TournamentRefereeAllocation } from '@tournament-manager/persistent-data-model';
import { FragmentRefereeAllocationService } from './fragment-referee-allocation.service';
import { TournamentRefereeAllocationService } from './tournament-referee-allocation.service';
import { FragmentRefereeAllocationStatisticsService } from './fragment-referee-allocation-statistics.service';
import { TournamentRefereeAllocationStatisticsService } from './tournament-referee-allocation-statistics.service';

@Injectable({
  providedIn: 'root'
})
export class RefereeAllocationService {

  tournamentRefereeAllocationService = inject(TournamentRefereeAllocationService);
  tournamentRefereeAllocationStatisticsService = inject(TournamentRefereeAllocationStatisticsService);
  fragmentRefereeAllocationService = inject(FragmentRefereeAllocationService);
  fragmentRefereeAllocationStatisticsService = inject(FragmentRefereeAllocationStatisticsService);


  deleteFragmentAllocation(
    fragmentAllocation: FragmentRefereeAllocation,
    tournamentAllocations: TournamentRefereeAllocation[]): Observable<any> {
    const obs: Observable<any>[] = [of('')];
    // remove the fragment from the TournamentAlloc using it
    tournamentAllocations.forEach(tAlloc => {
      const fAllocIdx = tAlloc.fragmentRefereeAllocations.findIndex(faDesc => faDesc.id !== fragmentAllocation.id);
      if (fAllocIdx >= 0) {
        tAlloc.fragmentRefereeAllocations.splice(fAllocIdx, 1);
        obs.push(this.tournamentRefereeAllocationService.save(tAlloc));
        //TODO recompute TournamentRefereeAllocationStatistics
      }
    });
    // Delete the fragment from the database
    obs.push(from(this.fragmentRefereeAllocationService.delete(fragmentAllocation.id)));

    // Delete the fragement referee allocation statistics
    obs.push(
      from(
        this.fragmentRefereeAllocationStatisticsService
          .deletebyFragmentRefereeAllocationId(fragmentAllocation.id)
      )
    );

    return forkJoin(obs);
  }
  duplicateTournamentAllocation(tourAlloc: TournamentRefereeAllocation): Observable<TournamentRefereeAllocation> {
      const newTourAlloc: TournamentRefereeAllocation = {
      id: '', lastChange: 0, current: false, name: 'Copy of ' + tourAlloc.name, tournamentId: tourAlloc.tournamentId,
      fragmentRefereeAllocations: tourAlloc.fragmentRefereeAllocations.map(fra => { return {...fra}; })
    };
    return this.tournamentRefereeAllocationService.save(newTourAlloc);
  }

  deleteTournamentAllocation(tourAlloc: TournamentRefereeAllocation) {
    return Promise.all([
        // Delete the allocation
        this.tournamentRefereeAllocationService.delete(tourAlloc.id),
        // delete the statistics linked to the allocation
        this.tournamentRefereeAllocationStatisticsService.deleteByAllocationId(tourAlloc.id)
      ]);
  }
}
