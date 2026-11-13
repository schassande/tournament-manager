import * as admin from 'firebase-admin';
import { CallableRequest, onCall } from 'firebase-functions/v2/https';
import { default_drawlibs, PDrawType } from '../persistent-data-model';
import { dateToEpoch } from '../common-persistence';
import { platformAdmin, verifiedIdentity } from '../identity/authorization';

/** Result returned after checking or seeding the persisted draw-type templates. */
export interface InitializePDrawTypesResponse {
  initialized: boolean;
  count: number;
}

/** Seeds default draw types only for a platform administrator and only once. */
export async function initializePDrawTypesHandler(
  request: CallableRequest<void>,
): Promise<InitializePDrawTypesResponse> {
  const identity = verifiedIdentity(request);
  const firestore = admin.firestore();
  return firestore.runTransaction(async (transaction) => {
    if (!(await platformAdmin(transaction, identity))) {
      return { initialized: false, count: 0 };
    }

    const collection = firestore.collection('draw-type');
    const existing = await transaction.get(collection);
    if (!existing.empty) return { initialized: false, count: existing.size };

    const lastChange = dateToEpoch(new Date());
    for (const drawType of default_drawlibs) {
      const reference = collection.doc();
      const persisted: PDrawType = {
        ...drawType,
        id: reference.id,
        lastChange,
        enabled: true,
        groups: drawType.groups.map((group) => ({ ...group })),
      };
      transaction.create(reference, persisted);
    }
    return { initialized: true, count: default_drawlibs.length };
  });
}

/** Callable invoked by the platform DrawType administration screen. */
export const initializePDrawTypes = onCall({ timeoutSeconds: 540 }, initializePDrawTypesHandler);
