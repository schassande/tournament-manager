import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SelectionService {

 private actionSubject = new Subject<AllocationAction>();
 public action$ = this.actionSubject.asObservable();

  private _currentSelection = signal<SelectionDescriptor|null>(null);
  public currentSelection = this._currentSelection.asReadonly();
  public clipboard : ClipboardItem|undefined;

  setCurrentSelection(selection: SelectionDescriptor|null) {
    this._currentSelection.set(selection);
  }
  public emitAction(event: AllocationAction) {
    this.actionSubject.next(event);
  }
}
export interface SelectionDescriptor {
  tournamentId: string;
  viewName: 'Appointments' | 'Other';
  partId: string;
  partIdx: number;
  timeslotId: string;
  timeslotIdx: number;
  fieldId: string;
  fieldIdx: number;
  cellType: 'Referee' | 'Coach' | 'None' | 'EmptySlot';
  inCellPosition: number;
  nbLine: number;
}
 export interface ClipboardItem {
  tournamentId: string;
  viewName: 'Appointments' | 'Other';
  type: 'Referee' | 'Coaches';
  attendeeIds: string[];
  partId: string;
  partIdx: number;
  timeslotId: string;
  timeslotIdx: number;
  fieldId: string;
  fieldIdx: number;
  gameId: string;
  clipboardAction: 'Copy' | 'Cut';
 }

 export interface AllocationAction {
  tournamentId: string;
  allocationId: string;
  partId: string;
  partIdx: number;
  timeslotId: string;
  timeslotIdx: number;
  fieldId: string;
  fieldIdx: number;
  gameId: string;
  action: 'SetReferee' | 'DeleteReferee' | 'SetRefereeCoach' | 'DeleteRefereeCoach';
  attendeeIds: string[];
  inCellPosition: number;
 }
