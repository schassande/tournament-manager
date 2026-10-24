import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import {
  WaterCarrierMatch,
  WaterCarrierPlanning,
  waterCarrierBlockingReason,
} from '@tournament-manager/persistent-data-model';
import { WaterCarrierService } from '../../service/water-carrier.service';
import { WaterCarrierPdfService } from '../../service/water-carrier-pdf.service';

/** Public match grid with accessible, snapshot-validated referee self-allocation. */
@Component({
  selector: 'app-water-carrier',
  imports: [ButtonModule],
  templateUrl: './water-carrier.component.html',
  styleUrl: './water-carrier.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WaterCarrierComponent {
  readonly planning = input.required<WaterCarrierPlanning>();
  readonly refreshing = input(false);
  readonly refresh = output<void>();
  readonly changed = output<void>();
  private readonly service = inject(WaterCarrierService);
  private readonly pdf = inject(WaterCarrierPdfService);
  readonly pending = signal(false);
  readonly exporting = signal(false);
  readonly error = signal('');
  readonly cells = computed(
    () => new Map(this.planning().matches.map((match) => [`${match.timeslotId}:${match.fieldId}`, match])),
  );

  /** Finds a match at the selected timeslot and field. */
  match(slotId: string, fieldId: string): WaterCarrierMatch | undefined {
    return this.cells().get(`${slotId}:${fieldId}`);
  }

  /** Formats times in the tournament timezone, independently of the browser timezone. */
  time(start: number): string {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: this.planning().timeZone,
    }).format(new Date(start * 1000));
  }

  /** Indicates the current user's existing water-carrier assignment. */
  assigned(match: WaterCarrierMatch): boolean {
    return match.waterCarriers.some((person) => person.attendeeId === this.planning().actor?.attendeeId);
  }

  /** Identifies the current user's referee assignments for an independent visual indicator. */
  refereeing(match: WaterCarrierMatch): boolean {
    return match.referees.some((person) => person.attendeeId === this.planning().actor?.attendeeId);
  }

  /** Returns the accessible explanation when adding an assignment is blocked. */
  blocked(match: WaterCarrierMatch): string | null {
    return waterCarrierBlockingReason(this.planning(), match);
  }

  /** Writes one desired state and delegates the post-success reload to the owning page. */
  async toggle(match: WaterCarrierMatch): Promise<void> {
    if (this.pending() || this.refreshing() || this.blocked(match)) return;
    const planning = this.planning();
    this.pending.set(true);
    this.error.set('');
    try {
      await this.service.setAssigned(planning, match, !this.assigned(match));
      this.changed.emit();
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : 'Unable to update your assignment. Please retry.');
    } finally {
      this.pending.set(false);
    }
  }

  /** Generates a downloadable PDF only through the authorized application action. */
  async download(): Promise<void> {
    if (!this.planning().actor?.canPrint || this.exporting()) return;
    this.exporting.set(true);
    this.error.set('');
    try {
      await this.pdf.download(this.planning());
    } catch {
      this.error.set('Unable to generate the PDF. Please retry.');
    } finally {
      this.exporting.set(false);
    }
  }
}
