import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  HostListener,
  inject,
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

/** Selected coach ranking editor; the page controls authorization and commits shared changes. */
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
  readonly coachId = input('');
  readonly coachName = input('');
  readonly authorized = input(false);
  readonly busy = input(false);
  readonly changes = output<IndividualRankingChanges>();
  readonly lockControl = new FormControl(false, { nonNullable: true });
  readonly dragging = signal<string | null>(null);
  readonly dropIndex = signal<number | null>(null);
  readonly editable = computed(
    () =>
      !!this.coachId() &&
      this.authorized() &&
      !this.busy() &&
      ['INDIVIDUAL_RANKING', 'PANEL_RANKING'].includes(this.ranking().status),
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
  private dragPreview: HTMLElement | null = null;
  private dragOffset = { x: 0, y: 0 };

  /** Restores committed lock state and cancels obsolete drags when the page context changes. */
  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancelDrag());
    effect(() => {
      this.lockControl.setValue(this.individual()?.locked ?? false, { emitEvent: false });
      if (this.editable()) this.lockControl.enable({ emitEvent: false });
      else this.lockControl.disable({ emitEvent: false });
      this.ranking();
      this.coachId();
      this.cancelDrag();
    });
  }

  /** Supplies a stable missing identity without repairing or modifying CLOSED data. */
  referee(id: string): Attendee {
    return this.byId().get(id) ?? ({ id } as Attendee);
  }

  /** Proposes the target lock action and retains the committed toggle until persistence succeeds. */
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

  /** Starts an unlocked drag with an opaque cell overlay instead of the translucent native image. */
  startDrag(event: DragEvent, id: string): void {
    if (!this.canReorder()) {
      event.preventDefault();
      return;
    }
    this.cancelDrag();
    this.dragging.set(id);
    event.dataTransfer?.setData('text/plain', id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    if (event.dataTransfer && event.currentTarget instanceof HTMLElement) {
      const row = event.currentTarget;
      this.createDragPreview(row, event);
      // A transparent canvas suppresses the browser's translucent drag feedback.
      const emptyImage = row.ownerDocument.createElement('canvas');
      emptyImage.width = emptyImage.height = 1;
      event.dataTransfer.setDragImage(emptyImage, 0, 0);
    }
  }

  /** Allows an actual drop anywhere in the document while dragging one of this tab's referees. */
  @HostListener('document:dragover', ['$event'])
  allowDrop(event: DragEvent): void {
    this.positionDragPreview(event);
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
    this.cancelDrag();
    if (id) this.move(id, index);
  }

  /** An actual drop outside the ranked list returns a ranked referee to the available list. */
  @HostListener('document:drop', ['$event'])
  dropOutside(event: DragEvent): void {
    const id = this.dragging();
    if (!id) return;
    event.preventDefault();
    this.cancelDrag();
    this.move(id, null);
  }

  /** Escape/native drag cancellation clears transient state without saving. */
  @HostListener('document:dragend')
  cancelDrag(): void {
    this.dragPreview?.remove();
    this.dragPreview = null;
    this.dragging.set(null);
    this.dropIndex.set(null);
  }

  /** Hides the in-page preview when the pointer leaves the browser document. */
  @HostListener('document:dragleave', ['$event'])
  hideDragPreview(event: DragEvent): void {
    if (!event.relatedTarget && this.dragPreview) this.dragPreview.style.visibility = 'hidden';
  }

  /** Copies the full cell outside the scroll container, retaining the pointer's grab position. */
  private createDragPreview(row: HTMLElement, event: DragEvent): void {
    const bounds = row.getBoundingClientRect();
    this.dragOffset = {
      x: Math.max(0, Math.min(bounds.width, event.clientX - bounds.left)),
      y: Math.max(0, Math.min(bounds.height, event.clientY - bounds.top)),
    };

    // Preserve Angular style attributes while making the visual copy non-interactive.
    const preview = row.cloneNode(true) as HTMLElement;
    preview.classList.remove('drop-gap', 'drag-source');
    preview.classList.add('referee-drag-preview');
    preview.style.width = `${bounds.width}px`;
    preview.setAttribute('aria-hidden', 'true');
    preview.inert = true;
    preview.removeAttribute('id');
    preview.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
    row.ownerDocument.body.appendChild(preview);
    this.dragPreview = preview;
    this.positionDragPreview(event);
  }

  /** Positions the opaque overlay without intercepting the underlying drop targets. */
  private positionDragPreview(event: DragEvent): void {
    if (!this.dragPreview) return;
    this.dragPreview.style.visibility = 'visible';
    this.dragPreview.style.transform = `translate(${event.clientX - this.dragOffset.x}px, ${event.clientY - this.dragOffset.y}px)`;
  }
}
