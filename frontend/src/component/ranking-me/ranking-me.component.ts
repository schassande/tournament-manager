import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  HostListener,
  input,
  output,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import {
  Attendee,
  CoachRefereesRanking,
  IndividualRankingChanges,
  TournamentRefereeRanking,
} from '@tournament-manager/persistent-data-model';
import { compareUnrankedReferees, moveRankedReferee, rankingRefereeLabel } from './ranking-me-state';

/** Own ranking UI; the page commits changes and shares the result with other tabs. */
@Component({
  selector: 'app-ranking-me',
  imports: [ReactiveFormsModule, ButtonModule, ToggleSwitchModule],
  templateUrl: './ranking-me.component.html',
  styleUrl: './ranking-me.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RankingMeComponent {
  readonly ranking = input.required<TournamentRefereeRanking>();
  readonly referees = input.required<Attendee[]>();
  readonly individual = input<CoachRefereesRanking | null>(null);
  readonly busy = input(false);
  readonly changes = output<IndividualRankingChanges>();
  readonly lockControl = new FormControl(false, { nonNullable: true });
  readonly dragging = signal<string | null>(null);
  readonly dropIndex = signal<number | null>(null);
  readonly editable = computed(
    () => !this.busy() && ['INDIVIDUAL_RANKING', 'PANEL_RANKING'].includes(this.ranking().status),
  );
  readonly canReorder = computed(() => this.editable() && !this.individual()?.locked);
  readonly order = computed(() => this.individual()?.rankedRefereeAttendeeIds ?? []);
  readonly byId = computed(() => new Map(this.referees().map((item) => [item.id, item])));
  readonly available = computed(() =>
    this.ranking()
      .selectedRefereeAttendeeIds.filter((id) => !this.order().includes(id))
      .map((id) => this.referee(id))
      .sort(compareUnrankedReferees),
  );
  readonly slots = computed(() =>
    Array.from({ length: Math.max(this.ranking().nbRefereesToRank + 1, this.order().length) }, (_, index) => index),
  );
  readonly label = rankingRefereeLabel;

  /** Restores committed lock state and cancels obsolete drags when the page context changes. */
  constructor() {
    effect(() => {
      this.lockControl.setValue(this.individual()?.locked ?? false, { emitEvent: false });
      if (this.editable()) this.lockControl.enable({ emitEvent: false });
      else this.lockControl.disable({ emitEvent: false });
      this.ranking();
      this.dragging.set(null);
      this.dropIndex.set(null);
    });
  }

  /** Supplies a stable missing identity without repairing or modifying CLOSED data. */
  referee(id: string): Attendee {
    return this.byId().get(id) ?? ({ id } as Attendee);
  }

  /** Proposes the owner lock action and retains the committed toggle until persistence succeeds. */
  toggleLock(locked: boolean, event?: Event): void {
    // Native checkbox state changes before Angular's unchanged-value binding can restore it.
    if (event?.target instanceof HTMLInputElement) event.target.checked = this.individual()?.locked ?? false;
    this.lockControl.setValue(this.individual()?.locked ?? false, { emitEvent: false });
    if (this.editable() && locked !== (this.individual()?.locked ?? false)) this.changes.emit({ locked });
  }

  /** Shares dense insert/remove/reorder semantics across keyboard buttons and drag/drop. */
  move(id: string, index: number | null): void {
    if (!this.canReorder()) return;
    const next = moveRankedReferee(this.order(), this.ranking().selectedRefereeAttendeeIds, id, index);
    if (JSON.stringify(next) !== JSON.stringify(this.order())) this.changes.emit({ rankedRefereeAttendeeIds: next });
  }

  /** Starts an unlocked internal drag using the complete row as its preview. */
  startDrag(event: DragEvent, id: string): void {
    if (!this.canReorder()) {
      event.preventDefault();
      return;
    }
    this.dragging.set(id);
    event.dataTransfer?.setData('text/plain', id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    if (event.dataTransfer && event.currentTarget instanceof HTMLElement) {
      const row = event.currentTarget;
      const bounds = row.getBoundingClientRect();
      event.dataTransfer.setDragImage(
        row,
        Math.max(0, Math.min(bounds.width, event.clientX - bounds.left)),
        Math.max(0, Math.min(bounds.height, event.clientY - bounds.top)),
      );
    }
  }

  /** Allows an actual drop anywhere in the document while dragging one of this tab's referees. */
  @HostListener('document:dragover', ['$event'])
  allowDrop(event: DragEvent): void {
    if (this.dragging() && this.canReorder()) event.preventDefault();
    if (!(event.target instanceof Element) || !event.target.closest('.ranked-list')) this.dropIndex.set(null);
  }

  /** Opens an insertion gap before the hovered ranking slot during an internal drag. */
  previewDrop(event: DragEvent, index: number): void {
    if (!this.dragging() || !this.canReorder()) return;
    event.preventDefault();
    this.dropIndex.set(index);
  }

  /** A drop in the right list inserts at the slot; trailing empty slots append without gaps. */
  dropRanked(event: DragEvent, index: number): void {
    event.preventDefault();
    event.stopPropagation();
    const id = this.dragging();
    this.dragging.set(null);
    this.dropIndex.set(null);
    if (id) this.move(id, index);
  }

  /** An actual drop outside the ranked list returns a ranked referee to the available list. */
  @HostListener('document:drop', ['$event'])
  dropOutside(event: DragEvent): void {
    const id = this.dragging();
    if (!id) return;
    event.preventDefault();
    this.dragging.set(null);
    this.dropIndex.set(null);
    this.move(id, null);
  }

  /** Escape/native drag cancellation clears transient state without saving. */
  @HostListener('document:dragend')
  cancelDrag(): void {
    this.dragging.set(null);
    this.dropIndex.set(null);
  }
}
