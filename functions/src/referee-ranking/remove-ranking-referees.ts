import { CallableRequest, onCall } from 'firebase-functions/v2/https';
import { RankingMaintenanceResponse, RemoveRankingRefereesRequest } from '../persistent-data-model';
import { maintainRanking } from './maintenance';

/** Authenticated all-or-nothing removal, including locked and practice rankings. */
export const removeRankingReferees = onCall<RemoveRankingRefereesRequest>(
  (request: CallableRequest<RemoveRankingRefereesRequest>): Promise<RankingMaintenanceResponse> =>
    maintainRanking(request, true),
);
