import { TestBed } from '@angular/core/testing';
import {
  WaterCarrierMatch,
  WaterCarrierPlanning,
  waterCarrierBlockingReason,
} from '@tournament-manager/persistent-data-model';
import { WaterCarrierComponent } from './water-carrier.component';
import { WaterCarrierService } from '../../service/water-carrier.service';
import { WaterCarrierPdfService } from '../../service/water-carrier-pdf.service';

/** Creates a minimal published match, using seconds for its interval. */
function match(id: string, start = 1000, end = 2000): WaterCarrierMatch {
  return {
    id,
    dayId: 'day',
    timeslotId: id,
    fieldId: 'field',
    start,
    end,
    description: 'Open - Final',
    backgroundColor: '#ffffff',
    fontColor: '#000000',
    referees: [],
    waterCarriers: [],
  };
}

/** Creates the API snapshot available to the current authenticated referee. */
function planning(): WaterCarrierPlanning {
  return {
    tournamentId: 't',
    tournamentName: 'Cup',
    timeZone: 'Europe/Paris',
    onlineEnabled: true,
    printedEnabled: true,
    periods: [{ id: 'fragment', label: 'Day 1' }],
    selectedPeriodId: 'fragment',
    fields: [{ id: 'field', name: 'Field 1' }],
    timeslots: [{ id: 'game', start: 1000, end: 2000 }],
    matches: [match('game')],
    actor: { attendeeId: 'me', canAllocate: true, canPrint: false, isCoach: false, conflicts: {} },
  };
}

describe('WaterCarrierComponent', () => {
  let service: jasmine.SpyObj<WaterCarrierService>;
  let pdf: jasmine.SpyObj<WaterCarrierPdfService>;

  beforeEach(() => {
    service = jasmine.createSpyObj('WaterCarrierService', ['setAssigned']);
    pdf = jasmine.createSpyObj('WaterCarrierPdfService', ['download']);
    TestBed.configureTestingModule({
      imports: [WaterCarrierComponent],
      providers: [
        { provide: WaterCarrierService, useValue: service },
        { provide: WaterCarrierPdfService, useValue: pdf },
      ],
    });
  });

  it('keeps public reading available without exposing assignment or export controls', () => {
    const fixture = TestBed.createComponent(WaterCarrierComponent);
    fixture.componentRef.setInput('planning', { ...planning(), actor: null });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Open - Final');
    expect(fixture.nativeElement.textContent).not.toContain('Assign myself');
    expect(fixture.nativeElement.textContent).not.toContain('Download PDF');
  });

  it('emits a reload only after a successful write and prevents double clicks while pending', async () => {
    let complete!: () => void;
    service.setAssigned.and.returnValue(
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
    );
    const fixture = TestBed.createComponent(WaterCarrierComponent);
    const snapshot = planning();
    fixture.componentRef.setInput('planning', snapshot);
    let changes = 0;
    fixture.componentInstance.changed.subscribe(() => changes++);
    const first = fixture.componentInstance.toggle(snapshot.matches[0]);
    await fixture.componentInstance.toggle(snapshot.matches[0]);
    expect(service.setAssigned).toHaveBeenCalledTimes(1);
    expect(changes).toBe(0);
    complete();
    await first;
    expect(changes).toBe(1);
  });

  it('preserves the snapshot and displays a retryable write error', async () => {
    service.setAssigned.and.rejectWith(new Error('Permission denied'));
    const fixture = TestBed.createComponent(WaterCarrierComponent);
    const snapshot = planning();
    fixture.componentRef.setInput('planning', snapshot);
    await fixture.componentInstance.toggle(snapshot.matches[0]);
    expect(snapshot.matches[0].waterCarriers).toEqual([]);
    expect(fixture.componentInstance.error()).toContain('Permission denied');
    expect(fixture.componentInstance.pending()).toBeFalse();
  });

  it('lets a coach export but does not grant allocation eligibility', async () => {
    pdf.download.and.resolveTo();
    const fixture = TestBed.createComponent(WaterCarrierComponent);
    const snapshot = planning();
    snapshot.actor = { attendeeId: 'coach', canAllocate: false, canPrint: true, isCoach: true, conflicts: {} };
    fixture.componentRef.setInput('planning', snapshot);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Download PDF');
    expect(fixture.nativeElement.textContent).not.toContain('Assign myself');
    await fixture.componentInstance.download();
    expect(pdf.download).toHaveBeenCalledWith(snapshot);
  });
});

describe('water-carrier snapshot conflict policy', () => {
  it('blocks referee and water-carrier overlaps but allows back-to-back matches', () => {
    const snapshot = planning();
    const other = match('other', 1500, 2500);
    other.referees = [{ attendeeId: 'me', name: 'Me' }];
    snapshot.matches.push(other);
    expect(waterCarrierBlockingReason(snapshot, snapshot.matches[0])).toBe('Referee assignment');
    other.referees = [];
    other.waterCarriers = [{ attendeeId: 'me', name: 'Me' }];
    expect(waterCarrierBlockingReason(snapshot, snapshot.matches[0])).toBe('Water carrier assignment');
    other.start = 2000;
    expect(waterCarrierBlockingReason(snapshot, snapshot.matches[0])).toBeNull();
  });

  it('blocks unavailability while keeping removal of an existing assignment possible', () => {
    const snapshot = planning();
    snapshot.actor!.conflicts['game'] = 'Unavailable';
    expect(waterCarrierBlockingReason(snapshot, snapshot.matches[0])).toBe('Unavailable');
    snapshot.matches[0].waterCarriers = [{ attendeeId: 'me', name: 'Me' }];
    expect(waterCarrierBlockingReason(snapshot, snapshot.matches[0])).toBeNull();
  });
});
