import * as admin from 'firebase-admin';
import { CallableRequest, onCall } from 'firebase-functions/v2/https';
import { platformAdmin, verifiedIdentity } from '../identity/authorization';

/** Returns whether the verified caller belongs to the platform-admin collection. */
export async function getPlatformAdminStatusHandler(
  request: CallableRequest<void>,
): Promise<{ isPlatformAdmin: boolean }> {
  const identity = verifiedIdentity(request);
  const isPlatformAdmin = await admin.firestore().runTransaction((transaction) => platformAdmin(transaction, identity));
  return { isPlatformAdmin };
}

/** Callable used by the global menu and platform administration routes. */
export const getPlatformAdminStatus = onCall({ timeoutSeconds: 30 }, getPlatformAdminStatusHandler);
