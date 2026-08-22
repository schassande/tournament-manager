import { ChangeDetectorRef, Component, computed, effect, inject, input, model, output, } from '@angular/core';
import { DateService } from '../service/date.service';
import { Day, defaultSlotType, PartDay, Timeslot, SlotType } from '@tournament-manager/persistent-data-model';
import { CardModule } from 'primeng/card';
import { FormsModule } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';
import { CommonModule } from '@angular/common';
import { TournamentDayTimeslotEditComponent } from './tournament-day-timeslot-edit.component';
import { TimeslotService } from '../service/timeslot.service';
import { DialogModule } from 'primeng/dialog';
import { ListboxModule } from 'primeng/listbox';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  selector: 'app-tournament-day-edit',
  imports: [CardModule, CommonModule, DialogModule, FormsModule, DatePickerModule, InputTextModule, ListboxModule, TournamentDayTimeslotEditComponent],
  template: `
  <p-card class="dayCard">
    <ng-template #header>
      <div class="dayId" [ngClass]="{ severalDayId : isLastDay() && hasSeveralDays() }">
        <span>Day {{day().id}}</span>
        @if (isLastDay() && hasSeveralDays()) {
        <div class="actions actions-day">
          <i class="pi pi-trash  action-remove" aria-label="remove day"  (click)="removeDay()"></i>
        </div>
        }
      </div>
      <div class="dayDate">
        <p-date-picker type="date" [(ngModel)]="dayDate"  required="true" [firstDayOfWeek]="1" showButtonBar="true"
          (onSelect)="onDateChange()" dateFormat="yy/mm/dd" [showIcon]="true" [required]="true"
          [readonlyInput]="!isFirstDay()" style="text-align: center;"></p-date-picker>
      </div>
      <div class="dayOfWeek">{{dayOfWeek()}}</div>
      <div style="clear: both;"></div>
    </ng-template>
    @if (day()) {
    <div class="dayBody">
      @for(part of day().parts; let isLastPart = $last; track part.id; let isFirstPart = $first; let partIdx = $index) {
        <div class="partBlock" [ngClass]="{ firstParts : !isLastPart && day().parts.length > 1 }">
          <div class="partHeader">
            @if (isLastPart) {
              <div class="actions part-management-actions">
                <i class="pi pi-plus action-add"     aria-label="add part" title="Add part"     (click)="openAddPartDialog(part.id)"></i>
                @if (day().parts.length > 1) {
                  <i class="pi pi-trash action-remove" aria-label="remove part"  (click)="removePart(part.id)"></i>
                }
              </div>
            }
            <div class="actions">
              @if (part.timeslots.length > 1) {
                <button type="button" class="action-button" aria-label="split part" title="Split part" (click)="openSplitDialog(part)"><i class="pi pi-arrow-up-right-and-arrow-down-left-from-center action-part"></i></button>
              }
              @if (!isFirstPart) {
                <button type="button" class="action-button" aria-label="merge with previous part" title="Merge with previous part" (click)="mergePart(part.id)"><i class="pi pi-arrow-down-left-and-arrow-up-right-to-center action-part"></i></button>
                @if (day().parts[partIdx - 1].timeslots.length > 1) {
                  <button type="button" class="action-button" aria-label="move boundary up" title="Move boundary up" (click)="moveBoundaryUp(part.id)"><i class="pi pi-arrow-up action-part"></i></button>
                }
                @if (part.timeslots.length > 1) {
                  <button type="button" class="action-button" aria-label="move boundary down" title="Move boundary down" (click)="moveBoundaryDown(part.id)"><i class="pi pi-arrow-down action-part"></i></button>
                }
              }
            </div>
            <button type="button" class="part-name" (click)="openEditPartName(part)" [attr.aria-label]="'Edit part name ' + partName(part)">
              Part {{partName(part)}}
            </button>
            <div style="clear: both;"></div>
          </div>
          <div class="partBody">
            @for(timeslot of part.timeslots; track timeslot.id; let isFirstTS = $first) {
              <app-tournament-day-timeslot-edit
                [timeslotStart]="timeslot.start"
                [timeslotStartReadOnly]="!isFirstTS || !isFirstPart"
                [slotType]="timeslot.slotType ? timeslot.slotType : _defaultSlotType"
                (onAddTimeSlotAfter)="addTimeSlotAfter(part.id, timeslot.id)"
                (onRemoveTimeSlot)="removeTimeSlot(part.id, timeslot.id)"
                (onSlotTypeChange)="onTimeslotTypeChange(part.id, timeslot.id, $event)"
                (onTimeSlotStartChange)="onTimeslotStartChange(part.id, timeslot.id, $event)">
              </app-tournament-day-timeslot-edit>
              }
          </div>
        </div>
      }
    </div>
    }
  </p-card>
  <p-dialog header="Split part" [(visible)]="splitDialogVisible" [modal]="true" [style]="{ width: '25rem' }"
    (onHide)="closeSplitDialog()">
    <div class="split-dialog-content">
      <label for="split-part-name">New part name</label>
      <input id="split-part-name" type="text" pInputText [(ngModel)]="splitPartName" required />
      <label for="split-after-timeslot">Split after</label>
      <p-listbox inputId="split-after-timeslot" [(ngModel)]="splitAfterTimeslotId" [options]="splitOptions"
        optionLabel="label" optionValue="id" [style]="{ width: '100%' }" scrollHeight="200px"
        ariaLabel="Timeslot after which to split"></p-listbox>
      <div class="split-dialog-actions">
        <button type="button" (click)="closeSplitDialog()">Cancel</button>
        <button type="button" [disabled]="!splitPartName.trim() || !splitAfterTimeslotId" (click)="confirmSplit()">Split</button>
      </div>
    </div>
  </p-dialog>
  <p-dialog [header]="partNameDialogTitle" [(visible)]="partNameDialogVisible" [modal]="true" [style]="{ width: '25rem' }"
    (onHide)="closePartNameDialog()">
    <div class="split-dialog-content">
      <label for="part-name">Part name</label>
      <input id="part-name" type="text" pInputText [(ngModel)]="partNameValue" required (keydown.enter)="confirmPartName()" />
      <div class="split-dialog-actions">
        <button type="button" (click)="closePartNameDialog()">Cancel</button>
        <button type="button" [disabled]="!partNameValue.trim()" (click)="confirmPartName()">Save</button>
      </div>
    </div>
  </p-dialog>
  `,
  styles: [`
    .p-card-body{ padding-top: 0 !important;}
    .severalDayId{ margin-left: 25px; }
    .dayId { margin-top: 10px; margin-bottom: 10px; font-weight: bold; text-align: center; font-size: 1.5rem}
    .actions-day { margin-right: 10px; }
    .actions { float: right; }
    .part-management-actions { margin-left: 8px; }
    .action-button { border: 0; background: transparent; padding: 0; margin-left: 5px; color: #555; cursor: pointer; }
    .action-button:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
    .action-part { font-size: 1rem; }
    .action-add { font-size: 1rem; color: green; }
    .action-remove { font-size: 1rem; color: red; margin-left: 5px;}
    .dayHeader { /*width: 200px;*/  }
    .dayInfo { text-align: center; }
    .dayDateRow {}
    .dayOfWeek { text-align: center;}
    .dayDate {margin: 0 auto; width: 50% }
    .dayDateRO {text-align: center; margin-top: 20px; margin-bottom: 20px;}
    .partBlock { padding-bottom: 10px; margin-bottom: 10px; }
    .firstParts { border-bottom : 1px solid grey; }
    .partHeader { font-weight: bold; margin-bottom: 10px; }
    .part-name { border: 0; background: transparent; padding: 0; font: inherit; font-weight: bold; cursor: pointer; }
    .part-name:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
    .partBody { }
    .split-dialog-content { display: flex; flex-direction: column; gap: 1rem; }
    .split-dialog-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
  `],
  standalone: true
})
export class TournamentDayEditComponent {
  dateService = inject(DateService);
  cdr = inject(ChangeDetectorRef);
  timeslotService = inject(TimeslotService);

  day = model.required<Day>();
  dayOfWeek = computed<string>(() => this.dateService.toDayOfWeek(this.day().date));
  hasSeveralDays = input.required<boolean>()
  isFirstDay = input.required<boolean>();
  isLastDay = input.required<boolean>();
  dayDate: Date = new Date();
  onRemoveDay = output<void>();
  onDayChanged = output<void>();
  onDayDateChanged = output<void>();

  splitDialogVisible = false;
  splitAfterTimeslotId = '';
  splitPartName = '';
  splitOptions: { id: string; label: string }[] = [];
  partNameDialogVisible = false;
  partNameDialogTitle = 'Part name';
  partNameValue = '';
  partNameDialogMode: 'create' | 'edit' = 'edit';
  partNameTargetId = '';

  _defaultSlotType = defaultSlotType;

  constructor() {
    effect(() => {
      this.dayDate = this.dateService.epochToDate(this.day().date);
      // console.debug('effect ', this.day().id, this.dayOfWeek(), this.dayDate);
    });
  }

  onDateChange() {
    this.day.update((day) => {
      day.date = this.dateService.dateToEpoch(this.dayDate);
      // console.debug('onDateChange ', this.day().id, this.dayDate, this.dateService.toDate(day.date));
      this.onDayDateChanged.emit();
      return day;
    });
  }

  removeDay() { this.onRemoveDay.emit()}

  /** Opens the name dialog before creating a new part. */
  openAddPartDialog(partId: string) {
    this.partNameDialogMode = 'create';
    this.partNameDialogTitle = 'Add part';
    this.partNameTargetId = partId;
    this.partNameValue = '';
    this.partNameDialogVisible = true;
  }

  /** Opens the name dialog for an existing part. */
  openEditPartName(part: PartDay) {
    this.partNameDialogMode = 'edit';
    this.partNameDialogTitle = 'Edit part name';
    this.partNameTargetId = part.id;
    this.partNameValue = this.partName(part);
    this.partNameDialogVisible = true;
  }

  /** Returns the persisted name, falling back to the identifier for legacy data. */
  partName(part: PartDay): string {
    return part.name || part.id;
  }

  /** Saves a new or edited part name and applies the requested operation. */
  confirmPartName() {
    const name = this.partNameValue.trim();
    if (!name) return;

    this.day.update( day => {
      if (this.partNameDialogMode === 'create') {
        if (this.timeslotService.addPartAfter(day, this.partNameTargetId, name)) {
          this.onDayChanged.emit();
        }
      } else {
        const part = day.parts.find(currentPart => currentPart.id === this.partNameTargetId);
        if (part && part.name !== name) {
          part.name = name;
          this.onDayChanged.emit();
        }
      }
      return day;
    });
    this.closePartNameDialog();
  }

  /** Closes the part-name dialog without changing the day. */
  closePartNameDialog() {
    this.partNameDialogVisible = false;
    this.partNameValue = '';
    this.partNameTargetId = '';
  }
  removePart(partId: string) {
    this.day.update( day => {
      this.timeslotService.removePart(day, partId);
      this.onDayChanged.emit();
      return day;
    });
  }

  /** Opens the split dialog with the first eligible timeslot selected. */
  openSplitDialog(part: PartDay) {
    this.splitOptions = part.timeslots.slice(0, -1).map(timeslot => ({
      id: timeslot.id,
      label: this.dateService.toTime(timeslot.start),
    }));
    this.splitAfterTimeslotId = this.splitOptions[0]?.id ?? '';
    this.splitPartName = '';
    this.splitDialogVisible = true;
  }

  /** Applies the selected split and closes the dialog. */
  confirmSplit() {
    const part = this.day().parts.find(currentPart => currentPart.timeslots.some(slot => slot.id === this.splitAfterTimeslotId));
    const name = this.splitPartName.trim();
    if (!part || !name || !this.splitAfterTimeslotId) return;

    this.day.update(day => {
      if (this.timeslotService.splitPart(day, part.id, this.splitAfterTimeslotId, name)) {
        this.onDayChanged.emit();
      }
      return day;
    });
    this.closeSplitDialog();
  }

  /** Closes the split dialog and clears its transient selection. */
  closeSplitDialog() {
    this.splitDialogVisible = false;
    this.splitAfterTimeslotId = '';
    this.splitPartName = '';
    this.splitOptions = [];
  }

  /** Merges the selected part into its predecessor. */
  mergePart(partId: string) {
    this.day.update(day => {
      if (this.timeslotService.mergePartWithPrevious(day, partId)) {
        this.onDayChanged.emit();
      }
      return day;
    });
  }

  /** Moves the boundary upward by moving the previous part's last slot. */
  moveBoundaryUp(partId: string) {
    this.day.update(day => {
      if (this.timeslotService.moveBoundaryUp(day, partId)) {
        this.onDayChanged.emit();
      }
      return day;
    });
  }

  /** Moves the boundary downward by moving the current part's first slot. */
  moveBoundaryDown(partId: string) {
    this.day.update(day => {
      if (this.timeslotService.moveBoundaryDown(day, partId)) {
        this.onDayChanged.emit();
      }
      return day;
    });
  }
  addTimeSlotAfter(partId: string, timeslotId: string) {
    this.day.update( day => {
      this.timeslotService.addTimeSlotAfter(day, partId, timeslotId);
      this.onDayChanged.emit();
      this.cdr.detectChanges();
      return day;
    });
  }
  removeTimeSlot(partId: string, timeslotId: string) {
    this.day.update( day => {
      this.timeslotService.removeTimeSlot(day, partId, timeslotId);
      this.onDayChanged.emit();
      return day;
    });
  }
  /**
   * The user has changed the type of the current timeslot.
   * Value is the new slot type.
   * Timeslot has been already updated (duration & end).
   */
  onTimeslotTypeChange(partId: string, timeslotId: string, slotType: SlotType) {
    this.day.update( day => {
      this.timeslotService.changeTimeSlotType(day, partId, timeslotId, slotType);
      this.onDayChanged.emit();
      return day;
    });

  }
  onTimeslotStartChange(partId: string, timeslotId: string, start: number) {
    this.day.update( day => {
      this.timeslotService.changeTimeslotStart(day, partId, timeslotId, start);
      this.onDayChanged.emit();
      return day;
    });
  }
}
