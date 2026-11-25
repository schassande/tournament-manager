import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GroupType, PDrawType } from '@tournament-manager/persistent-data-model';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { take } from 'rxjs';
import { PDrawTypeService } from '../../service/draw/pdrawtype.service';

const GROUP_TYPES: GroupType[] = [
  'NONE', 'POOL', 'POOL_RET', 'POOL_3', '2_WINS', '3_WINS', '4_WINS', '5_WINS', 'CUP2_RK2', 'SEMI',
  'CUP4_RK2', 'CUP4_RK4', 'CUP8_RK2', 'CUP8_RK4', 'CUP8_RK8', 'CUP16_RK2', 'CUP16_RK4', 'CUP16_RK8',
  'CUP32_RK2', 'CUP32_RK4', 'CUP32_RK8', 'CUP64_RK2', 'CUP64_RK4', 'CUP64_RK8', 'CUP128_RK2',
  'CUP128_RK4', 'CUP128_RK8',
];

/** Administrates persisted platform draw-type templates. */
@Component({
  selector: 'app-admin-draw-types',
  imports: [CommonModule, FormsModule, ButtonModule, InputNumberModule, InputTextModule, MessageModule, SelectModule],
  templateUrl: './admin-draw-types.page.html',
  styleUrl: './admin-draw-types.page.css',
})
export class AdminDrawTypesPage implements OnInit {
  private readonly drawTypes = inject(PDrawTypeService);
  private readonly router = inject(Router);

  readonly allDrawTypes = signal<PDrawType[]>([]);
  readonly selected = signal<PDrawType | null>(null);
  readonly filterNbTeam = signal<number | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly groupTypes = GROUP_TYPES.map((value) => ({ label: value, value }));

  /** Loads all draw types, including disabled records, for the administrator. */
  ngOnInit(): void {
    this.drawTypes.platformAdminStatus().pipe(take(1)).subscribe({
      next: (status) => {
        if (status.isPlatformAdmin) {
          this.reload();
        } else {
          this.loading.set(false);
          this.error.set('This screen is restricted to platform administrators.');
        }
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.reportError('Unable to verify platform administrator access.', error);
      },
    });
  }

  /** Returns sorted and filtered draw types for the left-hand list. */
  visibleDrawTypes(): PDrawType[] {
    const filter = this.filterNbTeam();
    return this.allDrawTypes()
      .filter((drawType) => filter === null || drawType.nbTeam === filter)
      .sort((left, right) => left.nbTeam - right.nbTeam || left.drawName.localeCompare(right.drawName));
  }

  /** Returns distinct team-count values for the filter. */
  teamCountOptions(): { label: string; value: number | null }[] {
    const values = [...new Set(this.allDrawTypes().map((drawType) => drawType.nbTeam))].sort((a, b) => a - b);
    return [{ label: 'All', value: null }, ...values.map((value) => ({ label: String(value), value }))];
  }

  /** Starts a new unsaved blank draw-type form. */
  newDrawType(): void {
    this.error.set('');
    this.message.set('');
    this.selected.set({
      id: '', lastChange: 0, enabled: true, nbTeam: 0, drawName: '', nbGroup: 0, nbGames: 0,
      requirePointCalculationConfig: false, groups: [],
    });
  }

  /** Selects a cloned draw type for editing. */
  select(drawType: PDrawType): void {
    this.error.set('');
    this.message.set('');
    this.selected.set(this.clone(drawType));
  }

  /** Adds an empty subgroup and recalculates derived attributes. */
  addGroup(): void {
    const drawType = this.selected();
    if (!drawType) return;
    drawType.groups.push({ position: drawType.groups.length, nbTeams: 0, groupType: 'NONE', nbGames: 0 });
    this.recalculate(drawType);
  }

  /** Removes a subgroup and normalizes subgroup positions. */
  deleteGroup(index: number): void {
    const drawType = this.selected();
    if (!drawType) return;
    drawType.groups.splice(index, 1);
    this.normalizeGroups(drawType);
    this.recalculate(drawType);
  }

  /** Recomputes all derived draw-type fields after subgroup editing. */
  groupChanged(): void {
    const drawType = this.selected();
    if (drawType) this.recalculate(drawType);
  }

  /** Initializes the default templates through the secured backend callable. */
  initializeDefaults(): void {
    if (!window.confirm('Initialize default draw types? Existing draw types will be kept.')) return;
    this.busy.set(true);
    this.drawTypes.initializeDefaults().subscribe({
      next: (result) => {
        this.message.set(result.initialized ? `${result.count} default draw types initialized.` : 'Draw types already initialized.');
        this.reload();
      },
      error: (error: unknown) => this.reportError('Unable to initialize default draw types.', error),
    });
  }

  /** Saves the selected draw type after validation and explicit confirmation. */
  save(): void {
    const drawType = this.selected();
    const validationError = drawType ? this.validate(drawType) : 'No draw type selected.';
    if (validationError) {
      this.error.set(validationError);
      return;
    }
    if (!window.confirm('Save this draw type?')) return;
    this.busy.set(true);
    this.drawTypes.save(drawType!).subscribe({
      next: (saved) => {
        this.message.set('Draw type saved.');
        this.busy.set(false);
        this.allDrawTypes.update((items) => {
          const withoutSaved = items.filter((item) => item.id !== saved.id);
          return [...withoutSaved, saved];
        });
        this.selected.set(this.clone(saved));
      },
      error: (error: unknown) => this.reportError('Unable to save draw type.', error),
    });
  }

  /** Deletes the selected draw type after explicit confirmation. */
  delete(): void {
    const drawType = this.selected();
    if (!drawType?.id) return;
    if (!window.confirm(`Delete "${drawType.drawName}"?`)) return;
    this.busy.set(true);
    this.drawTypes.delete(drawType.id).then(() => {
      this.message.set('Draw type deleted.');
      this.busy.set(false);
      this.allDrawTypes.update((items) => items.filter((item) => item.id !== drawType.id));
      this.selected.set(null);
    }).catch((error: unknown) => this.reportError('Unable to delete draw type.', error));
  }

  /** Exits the administration screen without restoring unsaved changes. */
  cancel(): void {
    void this.router.navigateByUrl('/home');
  }

  private reload(): void {
    this.loading.set(true);
    this.drawTypes.all().pipe(take(1)).subscribe({
      next: (items) => {
        items.forEach((item) => this.recalculate(item));
        this.allDrawTypes.set(items);
        this.loading.set(false);
        if (!items.length) this.message.set('No draw types found. Initialize the defaults or create one.');
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.reportError('Unable to load draw types.', error);
      },
    });
  }

  private validate(drawType: PDrawType): string {
    if (!drawType.drawName.trim()) return 'A draw type name is required.';
    if (!Number.isInteger(drawType.nbTeam) || drawType.nbTeam <= 0) return 'The number of teams must be a positive integer.';
    if (!drawType.groups.length) return 'At least one subgroup is required.';
    if (drawType.groups.reduce((sum, group) => sum + group.nbTeams, 0) !== drawType.nbTeam) return 'Subgroup team counts must equal the total team count.';
    if (drawType.groups.some((group, index) => group.position !== index || !Number.isInteger(group.nbTeams) || group.nbTeams < 0 || !Number.isInteger(group.nbGames) || group.nbGames < 0)) return 'Subgroup positions and numeric values are invalid.';
    return '';
  }

  private recalculate(drawType: PDrawType): void {
    drawType.nbTeam = drawType.groups.reduce((sum, group) => sum + group.nbTeams, 0);
    drawType.nbGroup = drawType.groups.length;
    drawType.nbGames = drawType.groups.reduce((sum, group) => sum + group.nbGames, 0);
    drawType.requirePointCalculationConfig = drawType.groups.some((group) => ['POOL', 'POOL_RET', 'POOL_3', '2_WINS', '3_WINS', '4_WINS', '5_WINS'].includes(group.groupType));
  }

  private normalizeGroups(drawType: PDrawType): void {
    drawType.groups.forEach((group, index) => (group.position = index));
  }

  private clone(drawType: PDrawType): PDrawType {
    return structuredClone(drawType);
  }

  private reportError(message: string, error: unknown): void {
    console.error(message, error);
    this.busy.set(false);
    this.error.set(message);
  }
}
