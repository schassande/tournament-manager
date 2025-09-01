import { onRequest, Request } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";

import * as auth                      from "firebase-admin/auth";
import * as admin                      from "firebase-admin";
import * as cors from 'cors'
import * as express from "express";

/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */


// Start writing functions
// https://firebase.google.com/docs/functions/typescript


admin.initializeApp();
const corsTrue = cors.default({origin: true});
const firestore = admin.firestore();

export interface Context {
    db: admin.firestore.Firestore,
    email: string;
}
const ctx: Context = { db: firestore, email: 'admin@coachreferee.com' };
const secrets = ['APP_API_KEY', 'SMTP_EMAIL_PASSWORD']

// ===================================================================
// Triggered functions
// See a full list of supported triggers at https://firebase.google.com/docs/functions

// On competition created from the database
// exports.newCompetitionEvent = onDocumentCreated(collectionCompetition + '/{cid}', async (snap) => {
//     await newCompetitionEventLib.func(snap.data?.data() as Competition, ctx);
//});
// ===================================================================


// ===================================================================
// Functions exposed over HTTPS
//export const sendCoaching = onRequest({secrets}, (request:Request, response: express.Response) =>
//    requestWithCorsAndId(request, response, sendCoachingLib.func));

export async function requestWithCorsAndId(request:Request, response: express.Response, coreFunction:(request:Request, response: express.Response, ctx: Context) =>Promise<any>): Promise<any> {
    console.log('Incoming request=' + request.method
        + ', headers=' + JSON.stringify(request.headers)
        + ', body=' + JSON.stringify(request.body),
        + ', process.APP_API_KEY='+process.env.APP_API_KEY!
        + ', process.SMTP_EMAIL_PASSWORD='+process.env.SMTP_EMAIL_PASSWORD!);

    corsTrue(request, response, () => {
        //get token
        const tokenStr = request.get('Authorization');
        if(!tokenStr) {
            throw new Error('Token required');
        }
        const tokenId = tokenStr.split('Bearer ')[1];
        //Verify token
        auth.getAuth().verifyIdToken(tokenId)
            .then((decoded: admin.auth.DecodedIdToken) => {
                // log console.log('decoded: ' + decoded);
                return coreFunction(request, response, ctx)
                    .catch((err: any) => {
                        console.log(err);
                        response.status(500).send({ error: err});
                    });
            })
            .catch((err) => {
                console.error(err);
            });
    });
}

const app = express.default()
app.disable("x-powered-by");
// Any requests to /api/users, /api/referees, /api/competitions, /api/coachings, /api/apikey
app.use(corsTrue)
//app.use("/users", usersApi.usersRouter);
export const api = onRequest({secrets}, app);
// ===================================================================


// ===================================================================
// Scheduled functions
// exports.voteAndUpgradeReminder = func.pubsub.schedule('4 00 * * 1')
//    .timeZone('Europe/London')
//    .onRun(async (context) => {
//        console.log('voteAndUpgradeReminder BEGIN ' + context.timestamp);
//        await voteAndUpgradeReminderLib.func(ctx);
//        console.log('voteAndUpgradeReminder END ' + context.timestamp);
//    });
// ===================================================================

