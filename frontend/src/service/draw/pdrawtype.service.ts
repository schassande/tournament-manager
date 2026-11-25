import { Injectable, inject } from '@angular/core';
import { PDrawType, } from '@tournament-manager/persistent-data-model';
import { query, where } from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { from, map, Observable } from 'rxjs';
import { AbstractPersistentDataService } from '../abstract-persistent-data.service';

/** Response returned by the platform DrawType initialization callable. */
export interface InitializePDrawTypesResponse {
  initialized: boolean;
  count: number;
}

/** Result returned by the platform-administrator status callable. */
export interface PlatformAdminStatusResponse {
  isPlatformAdmin: boolean;
}

/** Provides persistence operations for platform-managed draw-type templates. */
@Injectable({ providedIn: 'root' })
export class PDrawTypeService extends AbstractPersistentDataService<PDrawType> {
  private readonly functions = inject(Functions);

  /** Returns the Firestore collection containing persisted draw types. */
  protected override getCollectionName(): string {
    return 'draw-type';
  }

  /** Loads only enabled templates for use by tournament draw configuration. */
  public enabled(): Observable<PDrawType[]> {
    return this.query(query(this.itemsCollection(), where('enabled', '==', true)));
  }

  /** Initializes default templates through the trusted platform-admin callable. */
  public initializeDefaults(): Observable<InitializePDrawTypesResponse> {
    const call = httpsCallable<void, InitializePDrawTypesResponse>(this.functions, 'initializePDrawTypes');
    return from(call()).pipe(map((result) => result.data));
  }

  /** Checks platform-administrator authority without exposing the admin collection. */
  public platformAdminStatus(): Observable<PlatformAdminStatusResponse> {
    const call = httpsCallable<void, PlatformAdminStatusResponse>(this.functions, 'getPlatformAdminStatus');
    return from(call()).pipe(map((result) => result.data));
  }
}
