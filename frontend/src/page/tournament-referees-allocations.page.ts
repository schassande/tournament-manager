import { Component, effect, inject, signal } from '@angular/core';
import { forkJoin, map, mergeMap, Observable, of, take } from 'rxjs';

import { Attendee, Day, PartDay, Person, RefereeAllocation, RefereeCoach } from '../data.model';
import { AbstractTournamentPage } from '../component/tournament-abstract.page';
import { AttendeeService } from '../service/attendee.service';
import { DateService } from '../service/date.service';
import { PersonService } from '../service/person.service';
import { RefereeAllocationService } from '../service/referee-allocation.service';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-tournament-referees-allocation',
  imports: [ ButtonModule, CardModule, DatePipe],
  template: `
  <div style="height: 30px;">
  </div>
  <table class="dayAllocationTable">
    <tr>
      <th class="colDay">Day</th>
      <th class="colAllocation">Full allocations</th>
      @for(partNumber of partNumbers(); track partNumber) {
        <th class="colAllocation">Allocations of part {{partNumber}}</th>
      }
    </tr>
    @for(dayAllocation of dayAllocations(); track dayAllocation.day.id) {
      <tr>
        <td style="text-align: center;">
          <div style="font-weight: bold;">Day {{dayAllocation.day.id}}</div>
          <div>{{dayAllocation.day.date | date:'EEEE'}}</div>
          <div>{{dayAllocation.dateStr}}</div>
        </td>
        <td>
          @for(refAlloc of dayAllocation.allocations; track refAlloc.id) {
            <div class="allocation">
              <a (click)="routeToAllocationEdit(refAlloc)">{{refAlloc.name}}</a>
              <div style="float: right;">
                @if(refAlloc.active) {
                  <span (click)="toggleAllocationVisibilty(refAlloc)">
                    @if(refAlloc.visible) {
                      <i class="pi pi-eye action" aria-label="Unpublish the allocation " ></i>
                    } @else {
                      <i class="pi pi-eye-slash action" aria-label="Publish the allocation" ></i>
                    }
                  </span>
                } @else {
                  <span (click)="toggleAllocationActivation(refAlloc)"><i class="pi pi-play action" aria-label="Toggle visibility" title="Toggle visibility"></i></span>
                }
                <span (click)="duplicateAllocation(refAlloc)"><i class="pi pi-copy action" aria-label="Duplicate allocation" title="Duplicate allocation"></i></span>
                <span (click)="deleteAllocation(refAlloc)"><i class="pi pi-trash action" aria-label="Remove full day allocation" title="Remove full day allocation"></i></span>
              </div>
            </div>
          }
          <div (click)="createAllocation(dayAllocation.day.id)" style="text-align: right; margin-top: 20px;">
            <span style="vertical-align: top; margin-right: 5px;">Create a new full day allocation</span>
            <i class="pi pi-plus action"></i>
          </div>
        </td>
        @if(dayAllocation.showParts) {
          @for(partDayAllocation of dayAllocation.partDayAllocations; track partDayAllocation.partDay.id) {
            <td>
              @for(refAlloc of partDayAllocation.allocations; track refAlloc.id) {
                <div>
                  <a (click)="routeToAllocationEdit(refAlloc)">{{refAlloc.name}}</a>
                  <span (click)="toggleAllocationActivation(refAlloc)">
                    <i class="pi pi-trash action" aria-label="toggle active" ></i>
                    @if(refAlloc.active) {
                      <span>Active</span>
                    } @else {
                      <span>Inactive</span>
                    }
                  </span>
                  @if(refAlloc.active) {
                    <span (click)="toggleAllocationVisibilty(refAlloc)">
                      <i class="pi pi-trash action" aria-label="toggle visibility" ></i>
                      @if(refAlloc.active) {
                        <span>Visible</span>
                      } @else {
                        <span>Hidden</span>
                      }
                    </span>
                  }
                  <i class="pi pi-copy action" style="font-size: 0.9em" aria-label="duplicate allocation" (click)="duplicateAllocation(refAlloc)"></i>
                  <i class="pi pi-trash action action-remove" aria-label="remove part day allocation" (click)="deleteAllocation(refAlloc)"></i>
                </div>
              }
            </td>
          }
        }
      </tr>
    }
  </table>
  `,
  styles: [`
    .dayAllocationTable {border-collapse: collapse; margin: 0 auto; }
    .dayAllocationTable tr {  border-bottom: 1px solid lightgray; }
    .dayAllocationTable td, .dayAllocationTable th { padding: 5px; vertical-align: middle;  }
    .colAllocation { width: 300px; }
    .allocation { padding: 10px;}
    a { cursor: pointer; text-decoration: underline; color: blue; margin-right: 10px;}
    i { cursor: pointer;}
    .action { font-size: 1.3rem; margin-right: 10px;}
    .action.pi-trash {  color: red;}
    .action.pi-plus {  color: green;}
    .action.pi-copy {  color: blue;}
    .action.pi-eye, .action.pi-eye-slash { color: orange;}
    .dayBlock {
      display: inline-block;
      vertical-align: top;
      padding: 5px;
      margin: 5px;
      width: 300px;
    }
  `],
  standalone: true
})
export class TournamentRefereesAllocationsComponent extends AbstractTournamentPage  {

  private attendeeService = inject(AttendeeService);
  private personService = inject(PersonService);
  private refereeAllocationService = inject(RefereeAllocationService);
  private dateService = inject(DateService);
  dayAllocations = signal<DayAllocation[]>([]);
  partNumbers = signal<number[]>([]); //

  constructor() {
    super();
    effect(() => {
      if (this.tournament()) {
        this.computePartNumbers();
        this.loadAllocations();
      }
    })
  }
  computePartNumbers() {
    const maxPart = this.tournament()!.days.map(d => d.parts.length).reduce((a,b)=>Math.max(a,b), 0);
    if (maxPart < 2) {
      this.partNumbers.set([]);
    } else {
      this.partNumbers.set(Array.from({length: maxPart}, (_, i) => i + 1));
    }
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
  duplicateAllocation(allocation: RefereeAllocation) {
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
      allocation.visible = false;
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
    this.router.navigate(['tournament', this.tournament()!.id, 'allocation', allocation.id]);
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
