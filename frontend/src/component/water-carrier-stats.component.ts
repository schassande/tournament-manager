import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import {
  Attendee,
  FragmentRefereeAllocationStatistics,
  GameAttendeeAllocation,
} from '@tournament-manager/persistent-data-model';

/** A referee row displayed by the water-carrier statistics table. */
interface WaterCarrierStatsRow {
  attendee: Attendee;
  name: string;
  matchesRefereed: number;
  waterCarrierMatches: number;
  ratio: number | null;
}

/** Displays referee water-carrier contributions for one planning fragment. */
@Component({
  selector: 'app-water-carrier-stats',
  imports: [AutoCompleteModule, ButtonModule, CheckboxModule, FormsModule, SelectModule, TableModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './water-carrier-stats.component.html',
  styleUrl: './water-carrier-stats.component.css',
})
export class WaterCarrierStatsComponent {
  readonly referees = input.required<Attendee[]>();
  readonly statistics = input.required<FragmentRefereeAllocationStatistics[]>();
  readonly allocations = input.required<GameAttendeeAllocation[]>();
  readonly scopeId = input.required<string>();
  readonly refresh = output<void>();
  readonly search = signal('');
  readonly level = signal('');
  readonly category = signal('');
  readonly gender = signal('');
  readonly playerReferees = signal(false);
  readonly upgradeOnly = signal(false);
  readonly levels = [1, 2, 3, 4, 5, 6];
  readonly levelOptions = [
    { label: 'All levels', value: '' },
    ...this.levels.map((level) => ({ label: `Level ${level}`, value: String(level) })),
  ];
  readonly categoryOptions = [
    { value: '', label: 'All categories' },
    { value: 'J', label: 'Junior' },
    { value: 'O', label: 'Open' },
    { value: 'S', label: 'Senior' },
    { value: 'M', label: 'Master' },
  ];
  readonly genderOptions = [
    { value: '', label: 'All genders' },
    { value: 'M', label: 'Male' },
    { value: 'F', label: 'Female' },
  ];
  readonly rows = computed(() => {
    const waterCarrierCounts = new Map<string, Set<string>>();
    for (const allocation of this.allocations()) {
      if (allocation.fragmentRefereeAllocationId === this.scopeId() && allocation.attendeeRole === 'WaterCarrier') {
        const games = waterCarrierCounts.get(allocation.attendeeId) ?? new Set<string>();
        games.add(allocation.gameId);
        waterCarrierCounts.set(allocation.attendeeId, games);
      }
    }
    const stats = new Map(
      this.statistics()
        .filter((item) => item.fragmentRefereeAllocationId === this.scopeId())
        .map((item) => [item.refereeAttendeeId, item]),
    );
    return this.referees()
      .filter((referee) => this.matches(referee))
      .map((attendee) => this.toRow(attendee, stats.get(attendee.id), waterCarrierCounts.get(attendee.id)?.size ?? 0));
  });

  /** Emits a request to reload the selected planning period. */
  requestRefresh(): void {
    this.refresh.emit();
  }

  /** Formats the ratio as a whole percentage or an em dash when undefined. */
  formatRatio(ratio: number | null): string {
    return ratio === null ? '—' : `${Math.round(ratio)}%`;
  }

  /** Applies the Referee List filters to one referee. */
  private matches(referee: Attendee): boolean {
    const text = this.search().toLowerCase();
    const info = referee.referee;
    return (
      (!text ||
        [referee.person?.firstName, referee.person?.lastName, referee.person?.shortName].some((value) =>
          value?.toLowerCase().includes(text),
        )) &&
      (!this.level() || info?.badge === Number(this.level())) &&
      (!this.category() || info?.category === this.category()) &&
      (!this.gender() || referee.person?.gender === this.gender()) &&
      (!this.playerReferees() || referee.isPlayer) &&
      (!this.upgradeOnly() || !!info?.upgrade)
    );
  }

  /** Builds one table row from persisted statistics and assignments. */
  private toRow(
    attendee: Attendee,
    statistic: FragmentRefereeAllocationStatistics | undefined,
    waterCarrierMatches: number,
  ): WaterCarrierStatsRow {
    const matchesRefereed = statistic?.gameIds.length ?? 0;
    return {
      attendee,
      name: `${attendee.person?.firstName ?? ''} ${attendee.person?.lastName ?? ''}`.trim(),
      matchesRefereed,
      waterCarrierMatches,
      ratio: matchesRefereed ? (waterCarrierMatches / matchesRefereed) * 100 : null,
    };
  }
}
