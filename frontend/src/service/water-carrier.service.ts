import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { firstValueFrom } from 'rxjs';
import {
  GameAttendeeAllocation,
  WaterCarrierMatch,
  WaterCarrierPlanning,
  waterCarrierAllocationId,
  waterCarrierBlockingReason,
} from '@tournament-manager/persistent-data-model';
import { environment } from '../environments/environment';

/** Loads public planning snapshots and writes only the caller's explicit assignment state. */
@Injectable({ providedIn: 'root' })
export class WaterCarrierService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);

  /** Returns all display data in one call; the server derives any personalized context. */
  async load(tournamentId: string, fragmentId?: string): Promise<WaterCarrierPlanning> {
    await this.auth.authStateReady();
    const user = this.auth.currentUser;
    const token = user?.emailVerified ? await user.getIdToken() : undefined;
    let params = new HttpParams().set('tournamentId', tournamentId);
    if (fragmentId) params = params.set('fragmentRefereeAllocationId', fragmentId);
    return firstValueFrom(
      this.http.get<WaterCarrierPlanning>(`${environment.functionsApiUrl}/waterCarrier/planning`, {
        params,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }),
    );
  }

  /** Applies assign/unassign idempotently; rules independently resolve ownership through the attendee index. */
  async setAssigned(planning: WaterCarrierPlanning, match: WaterCarrierMatch, assigned: boolean): Promise<void> {
    const actor = planning.actor;
    const fragmentId = planning.selectedPeriodId;
    if (!actor?.canAllocate || !fragmentId || !planning.onlineEnabled) throw new Error('Referee access is required.');
    const reason = assigned ? waterCarrierBlockingReason(planning, match) : null;
    if (reason) throw new Error(reason);
    const id = waterCarrierAllocationId(planning.tournamentId, fragmentId, match.id, actor.attendeeId);
    const reference = doc(this.firestore, 'game-attendee-allocation', id);
    if (assigned) {
      const allocation: GameAttendeeAllocation = {
        id,
        lastChange: Date.now(),
        tournamentId: planning.tournamentId,
        fragmentRefereeAllocationId: fragmentId,
        gameId: match.id,
        attendeeId: actor.attendeeId,
        attendeeRole: 'WaterCarrier',
        attendeePosition: 0,
        half: 0,
      };
      await setDoc(reference, allocation);
    } else {
      // Retrying a completed removal needs no write and never recreates the assignment.
      if (!(await getDoc(reference)).exists()) return;
      await deleteDoc(reference);
    }
  }
}
