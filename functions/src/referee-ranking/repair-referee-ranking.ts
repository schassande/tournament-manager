import { CallableRequest, onCall } from 'firebase-functions/v2/https';
import { RankingMaintenanceRequest, RankingMaintenanceResponse } from '../persistent-data-model';
import { maintainRanking } from './maintenance';

/** Repairs persisted invalid references before closure; CLOSED is returned without writes. */
export const repairRefereeRanking = onCall<RankingMaintenanceRequest>(
  (request: CallableRequest<RankingMaintenanceRequest>): Promise<RankingMaintenanceResponse> =>
    maintainRanking(request, false),
);
