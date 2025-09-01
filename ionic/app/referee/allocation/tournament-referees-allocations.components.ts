import { DateService } from 'src/app/shared/services/date.service';
import { Attendee, Person, RefereeAllocation, RefereeCoach } from './../../shared/data.model';
import { Component, effect, inject, signal } from '@angular/core';
import { forkJoin, map, mergeMap, Observable, of, take } from 'rxjs';
import { Day, PartDay } from 'src/app/shared/data.model';
import { AttendeeService } from 'src/app/shared/services/attendee.service';
import { PersonService } from 'src/app/shared/services/person.service';
import { RefereeAllocationService } from 'src/app/shared/services/referee-allocation.service';
import { AbstractTournamentComponent } from 'src/app/shared/tournament-abstract.service';

@Component({
  selector: 'app-tournament-referees-allocation',
  template: `
  <div>
  @for(dayAllocation of dayAllocations(); track dayAllocation.day.id) {
    <p-card class="dayBlock">
      <h3>Day {{dayAllocation.day.id}}: {{dayAllocation.dateStr}}</h3>
      <ul>
      @for(refAlloc of dayAllocation.allocations; track refAlloc.id) {
        <li>
          <a (click)="routeToAllocationEdit(refAlloc)">Allocation {{refAlloc.name}}</a>
          <i class="pi pi-trash action action-remove" aria-label="remove full day allocation" (click)="deleteAllocation(refAlloc)"></i>
        </li>
      }
      </ul>
      <p-button (click)="createAllocation(dayAllocation.day.id)">Create Full day Allocation</p-button>
      @for(partDayAllocation of dayAllocation.partDayAllocations; track partDayAllocation.partDay.id) {
        <div>
          <h3>Part {{partDayAllocation.partDay.id}}</h3>
          <ul>
          @for(refAlloc of partDayAllocation.allocations; track refAlloc.id) {
            <li>
              <a (click)="routeToAllocationEdit(refAlloc)">Allocation {{refAlloc.name}}</a>
              <span (click)="toggleAllocationActivation(refAlloc)">
                <i class="pi pi-trash action" aria-label="toggle active" ></i>
                @if(refAlloc.active) {
                  <span>Active</span>
                } @else {
                  <span>Inactive</span>
                }
                &#44;
              </span>
              @if(refAlloc.active) {
                <span (click)="toggleAllocationVisibilty(refAlloc)">
                  <i class="pi pi-trash action" aria-label="toggle visibility" ></i>
                  @if(refAlloc.active) {
                    <span>Visible</span>
                  } @else {
                    <span>Hidden</span>
                  }
                  &#44;
                </span>
              }
              <i class="pi pi-trash action action-remove" aria-label="remove part day allocation" (click)="deleteAllocation(refAlloc)"></i>
            </li>
          }
          </ul>
        </div>
        <p-button (click)="createAllocation(dayAllocation.day.id, partDayAllocation.partDay.id)">Create Part day Allocation</p-button>
      }
    </p-card>
  }
  </div>
  `,
  styles: [`
    .action { font-size: 1.3rem}
    .action-remove { margin-right: 10px; color: red;}
    .dayBlock {
      display: inline-block;
      vertical-align: top;
      padding: 5px;
      margin: 5px;
    }

  `],
  standalone: false
})
export class TournamentRefereesAllocationsComponent extends AbstractTournamentComponent  {

  private attendeeService = inject(AttendeeService);
  private personService = inject(PersonService);
  private refereeAllocationService = inject(RefereeAllocationService);
  private dateService = inject(DateService);
  dayAllocations = signal<DayAllocation[]>([]);

  constructor() {
    super();
    effect(() => {
      if (this.tournament()) this.loadAllocations();
    })
  }

  createAllocation(dayId: string, partDayId: string|undefined = undefined) {
    const dayAlloc = this.dayAllocations().find((dayAllocation: DayAllocation) => dayAllocation.day.id === dayId);
    if (!dayAlloc) return;
    let active = dayAlloc.allocations.length === 0;
    if (partDayId && !active) {
      const partDayAlloc = dayAlloc.partDayAllocations.find((partDayAllocation: PartDayAllocation) => partDayAllocation.partDay.id === partDayId);
      if (!partDayAlloc) return;
      active = partDayAlloc.allocations.length === 0;
    }
    const allocation: RefereeAllocation = {
      id: '',
      name: '',
      tournamentId: this.tournament()!.id,
      lastChange: new Date().getTime(),
      dayId: dayId,
      refereeAllocatorAttendeeIds: [],
      refereeCoachAllocatorAttendeeIds: [],
      active,
      visible: false,
    };
    if (partDayId) allocation.partDayId = partDayId;
    this.refereeAllocationService.save(allocation).subscribe((allocation) => this.routeToAllocationEdit(allocation));
  }
  deleteAllocation(allocation: RefereeAllocation) {
    this.refereeAllocationService.delete(allocation.id).then(() => this.loadAllocations());
  }
  deuplicateAllocation(allocation: RefereeAllocation) {
    const newAllocation: RefereeAllocation = {...allocation};
    newAllocation.id = '';
    newAllocation.active = false;
    newAllocation.name = allocation.name + ' (copy)';
    this.refereeAllocationService.save(newAllocation).subscribe((allocation) => this.routeToAllocationEdit(allocation));
  }
  toggleAllocationActivation(allocation: RefereeAllocation) {
    if (allocation.active) {
      // deactivate all other allocations of the same day
      this.dayAllocations()
        .filter((dayAllocation: DayAllocation) => dayAllocation.day.id === allocation.dayId)
        .forEach((dayAllocation: DayAllocation) => {
          dayAllocation.allocations.forEach((refAlloc: RefereeAllocation) => {
            if (refAlloc.id !== allocation.id) {
              refAlloc.active = false;
              this.refereeAllocationService.save(refAlloc).subscribe();
            }
          })
        });
      allocation.active = !allocation.active;
      this.refereeAllocationService.save(allocation).subscribe();
    }
  }
  toggleAllocationVisibilty(allocation: RefereeAllocation) {
    if (allocation.active) {
      // only active allocations can be visible
      allocation.visible = !allocation.visible;
      this.refereeAllocationService.save(allocation).subscribe();
    }
  }
  routeToAllocationEdit(allocation: RefereeAllocation) {
    this.router.navigate(['referee', 'tournament', this.tournament()!.id, 'allocation', allocation.id]);
  }
  private loadAllocations() {
    this.refereeAllocationService.byTournament(this.tournament()!.id).pipe(
      mergeMap((allocations: RefereeAllocation[]) => {
        console.log('allocations', allocations);
        const obs: Observable<any>[] = [of('')];
        const refAllocViews: RefereeAllocationView[] = allocations.map((allocation: RefereeAllocation) => {
          const refAllocView: RefereeAllocationView = {...allocation,
            refereesAllocator: [],
            refereeCoachesAllocator: [],
            day: this.tournament()!.days.find((day: Day) => day.id === allocation.dayId)!,
          };
          if (allocation.partDayId) {
            refAllocView.partDay = refAllocView.day.parts.find((partDay: PartDay) => partDay.id === allocation.partDayId);
          }
          //load allocator of the referees
          allocation.refereeAllocatorAttendeeIds.forEach((attendeeId: string) => {
            obs.push(this.loadRefereeCoach(attendeeId).pipe(
              map((refereeCoach: RefereeCoach|undefined) => {
                if (refereeCoach) refAllocView.refereesAllocator.push(refereeCoach);
                return refereeCoach;
              }),
              take(1) // due to the use of the forkJoin operator
            ))
          });
          //load allocator of the referees coaches
          allocation.refereeCoachAllocatorAttendeeIds.forEach((attendeeId: string) => {
            obs.push(this.loadRefereeCoach(attendeeId).pipe(
              map((refereeCoach: RefereeCoach|undefined) => {
                if (refereeCoach) refAllocView.refereeCoachesAllocator.push(refereeCoach);
                return refereeCoach;
              }),
              take(1) // due to the use of the forkJoin operator
            ))
          });
          return refAllocView;
        });
        console.log('refAllocViews', refAllocViews);
        return forkJoin(obs).pipe(map(() => refAllocViews));
      }),

      // build internal structure of the allocations
      map((refAllocViews) => {

        const dayAllocations: DayAllocation[] = this.tournament()!.days.map((day: Day) => {
          const showParts = day.parts.length > 1;
          const dayAllocation = {
            day,
            dateStr: this.dateService.toDate(day.date),
            allocations: [],
            showParts,
            partDayAllocations: showParts
              ? day.parts.map((partDay: PartDay) => {
                  return { partDay, allocations: [] };
                })
              : [],
          };
          return dayAllocation;
        });

        refAllocViews.forEach((refAllocView: RefereeAllocationView) => {
          let dayAllocation = dayAllocations.find((dayAllocation: DayAllocation) => dayAllocation.day.id === refAllocView.day.id);
          if (!dayAllocation) return;
          if (refAllocView.partDay) {
            if (!dayAllocation.showParts) return;
            let partDayAllocation = dayAllocation.partDayAllocations.find((partDayAllocation: PartDayAllocation) => partDayAllocation.partDay.id === refAllocView.partDay?.id);
            if (!partDayAllocation) return;
            partDayAllocation.allocations.push(refAllocView);
          } else {
            dayAllocation.allocations.push(refAllocView);
          }
        });
        this.dayAllocations.set(dayAllocations);
        return this.dayAllocations;
      })
    ).subscribe();
  }

  private loadRefereeCoach(attendeeId: string): Observable<RefereeCoach|undefined> {
    return this.attendeeService.byId(attendeeId).pipe(
      map((attendee: Attendee|undefined) => {
        if (!attendee) return undefined;
        const refereeCoach: RefereeCoach = { attendee };
        if (attendee.personId) {
          this.personService.byId(attendee.personId).pipe(
            map((person: Person|undefined) => {
              if (person) refereeCoach.person = person;
              return refereeCoach;
            })
          ).subscribe();
        }
        return refereeCoach;
      })
    );
  }
}
interface RefereeAllocationView extends RefereeAllocation {
 day: Day;
 partDay?: PartDay;
 refereesAllocator: RefereeCoach[];
 refereeCoachesAllocator: RefereeCoach[];
}
interface DayAllocation {
  day: Day;
  dateStr: string
  allocations: RefereeAllocationView[];
  partDayAllocations: PartDayAllocation[];
  showParts: boolean;
}
interface PartDayAllocation {
  partDay: PartDay;
  allocations: RefereeAllocationView[];
}
