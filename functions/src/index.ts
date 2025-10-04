
import {onRequest} from 'firebase-functions/v2/https';

import * as admin                      from 'firebase-admin';
import * as cors from 'cors';
import * as express from 'express';
import {allocationStatisticsRouter} from './allocation-statistics';

/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */
admin.initializeApp();
const corsTrue = cors.default({origin: true});
const secrets = ['APP_API_KEY'];
const app = express.default();
app.disable('x-powered-by');
app.use(corsTrue);
app.use('/refereeAllocationStatistics', allocationStatisticsRouter);
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`API running on port ${port}`);
});

export const api = onRequest({secrets}, app);

