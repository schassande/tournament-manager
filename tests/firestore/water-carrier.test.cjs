const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const { createRequire } = require('node:module');
for (const name of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) {
  if (!/^(localhost|127\.0\.0\.1):\d+$/.test(process.env[name] || '')) throw new Error(`Local ${name} required.`);
}
const admin = require('../../functions/node_modules/firebase-admin');
const { loadWaterCarrierPlanning, waterCarrierRouter } = require('../../functions/lib/functions/src/water-carrier/read-planning');
const { waterCarrierAllocationId, attendeeIndexId } = require('../../functions/lib/persistent-data-model/src');
const project = 'demo-ranking-stage1';
admin.initializeApp({ projectId: project });
const db = admin.firestore();
const base = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${project}/databases/(default)/documents`;
let server;
let apiUrl;
const email = 'wc/ref:eree@example.com';
const actorId = 'wc-ref';

/** Creates a self-allocation fixture with the exact canonical ID expected by the rules. */
function assignment(gameId = 'wc-game', overrides = {}) {
  return { id: waterCarrierAllocationId('wc-t', 'wc-fragment', gameId, actorId), lastChange: 1,
    tournamentId: 'wc-t', fragmentRefereeAllocationId: 'wc-fragment', gameId, attendeeId: actorId,
    attendeeRole: 'WaterCarrier', attendeePosition: 0, half: 0, ...overrides };
}
/** Encodes fixtures for the emulator REST API. */
function value(data) {
  if (Array.isArray(data)) return { arrayValue: { values: data.map(value) } };
  if (data === null) return { nullValue: null };
  if (typeof data === 'object') return { mapValue: { fields: fields(data) } };
  if (typeof data === 'boolean') return { booleanValue: data };
  if (typeof data === 'number') return { integerValue: String(data) };
  return { stringValue: data };
}
/** Converts named fields to REST values. */
function fields(data) { return Object.fromEntries(Object.entries(data).map(([key, item]) => [key, value(item)])); }
/** Builds an unsigned token accepted only by the local rules emulator. */
function token(identity, verified = true) {
  const now = Math.floor(Date.now() / 1000);
  const encode = data => Buffer.from(JSON.stringify(data)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
    iss: `https://securetoken.google.com/${project}`, aud: project, sub: identity.toLowerCase(),
    user_id: identity.toLowerCase(), email: identity, email_verified: verified, iat: now, exp: now + 3600,
    auth_time: now, firebase: { sign_in_provider: 'custom', identities: {} },
  })}.`;
}
/** Attempts an actual rules-protected write, never an Admin SDK write. */
async function write(data, identity = email, method = 'PATCH', verified = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (identity) headers.Authorization = `Bearer ${token(identity, verified)}`;
  return fetch(`${base}/game-attendee-allocation/${encodeURIComponent(data.id)}`, {
    method, headers, body: method === 'PATCH' ? JSON.stringify({ fields: fields(data) }) : undefined,
  });
}
/** Includes emulator diagnostics when a rules assertion fails. */
async function status(response, expected) { assert.equal(response.status, expected, await response.text()); }

before(async () => {
  const slot = { id: 's1', start: 1000, end: 2000, duration: 1000, playingSlot: true, slotType: {} };
  await db.doc('tournament/wc-t').set({ id: 'wc-t', name: 'Coupe été', timeZone: 'Europe/Paris',
    enablesModules: ['ONLINE_WATER_CARRIER', 'PRINTED_WATER_CARRIER'],
    days: [{ id: 'd1', date: 1000, parts: [{ id: 'p1', name: 'Morning', dayId: 'd1',
      allFieldsAvaillable: true, availableFieldIds: [], timeslots: [slot, { ...slot, id: 's2', start: 2000, end: 3000 }] }] }],
    fields: [{ id: 'field', name: 'Field 1', orderView: 0 }], divisions: [{ id: 'division', name: 'Open', teams: [] }],
  });
  await db.doc('tournament-referee-allocation/wc-current').set({ id: 'wc-current', tournamentId: 'wc-t', current: true,
    fragmentRefereeAllocations: [{ id: 'wc-fragment', dayId: 'd1', partDayId: 'p1' }] });
  await db.doc('fragment-referee-allocation/wc-fragment').set({ id: 'wc-fragment', tournamentId: 'wc-t',
    visible: true, dayId: 'd1', partDayId: 'p1' });
  await db.doc('fragment-referee-allocation/wc-other').set({ id: 'wc-other', tournamentId: 'wc-t', visible: true, dayId: 'd1' });
  for (const [id, timeslotId] of [['wc-game', 's1'], ['wc-next', 's2']]) {
    await db.doc(`game/${id}`).set({ id, tournamentId: 'wc-t', dayId: 'd1', timeslotId, fieldId: 'field',
      divisionId: 'division', what: 'Final', homeTeamId: '', awayTeamId: '' });
  }
  for (const [id, address, roles] of [[actorId, email, ['Referee']], ['wc-other-ref', 'wc-other@example.com', ['Referee']],
    ['wc-coach', 'wc-coach@example.com', ['Coach']], ['wc-manager', 'wc-manager@example.com', ['TournamentManager']]]) {
    await db.doc(`attendee/${id}`).set({ id, tournamentId: 'wc-t', roles,
      person: { personId: id, email: address, firstName: 'Élodie', lastName: id, phone: 'private' } });
    await db.doc(`attendee-index/${attendeeIndexId('wc-t', address)}`).set({ attendeeId: id });
    await db.doc(`person/${id}`).set({ id, userAuthId: address, email: address });
  }
  await db.doc('game-attendee-allocation/wc-referee').set({ id: 'wc-referee', tournamentId: 'wc-t',
    fragmentRefereeAllocationId: 'wc-fragment', gameId: 'wc-next', attendeeId: actorId,
    attendeeRole: 'Referee', attendeePosition: 0, half: 0 });
  const backendRequire = createRequire(require.resolve('../../functions/lib/functions/src/index.js'));
  const app = backendRequire('express')();
  app.use(waterCarrierRouter);
  server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  apiUrl = `http://127.0.0.1:${server.address().port}/planning?tournamentId=wc-t`;
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await db.terminate();
  await admin.app().delete();
});

test('anonymous API returns one complete public projection and no private identity fields', async () => {
  const response = await fetch(apiUrl);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const planning = await response.json();
  assert.equal(planning.matches.length, 2);
  assert.deepEqual(planning.periods.map(item => item.id), ['wc-fragment']);
  assert.equal(planning.actor, null);
  assert.ok(planning.matches.every(match => !('writeScope' in match)));
  assert.equal(planning.matches[1].referees[0].name, 'Élodie wc-ref');
  assert.doesNotMatch(JSON.stringify(planning), /example\.com|personId|phone|private|roles/);
});
test('API validates arguments, invalid tokens, and non-current fragment requests', async () => {
  assert.equal((await fetch(`${apiUrl}&fragmentRefereeAllocationId=wc-other`)).status, 403);
  assert.equal((await fetch(`${apiUrl}&fragmentRefereeAllocationId=bad/identifier`)).status, 400);
  assert.equal((await fetch(apiUrl, { headers: { Authorization: 'invalid' } })).status, 401);
});
test('no current allocation has an empty state and no fallback', async () => {
  await db.doc('tournament-referee-allocation/wc-current').update({ current: false });
  try { assert.equal((await loadWaterCarrierPlanning('wc-t')).periods.length, 0); }
  finally { await db.doc('tournament-referee-allocation/wc-current').update({ current: true }); }
});
test('private indexed actor context distinguishes Referee eligibility, PDF roles and conflicts', async () => {
  const referee = await loadWaterCarrierPlanning('wc-t', undefined, { uid: email, email });
  assert.equal(referee.actor.canAllocate, true);
  assert.equal(referee.actor.canPrint, false);
  assert.equal(referee.actor.conflicts['wc-next'], 'Referee assignment');
  assert.equal(referee.actor.conflicts['wc-game'], undefined);
  for (const address of ['wc-coach@example.com', 'wc-manager@example.com']) {
    const planning = await loadWaterCarrierPlanning('wc-t', undefined, { uid: address, email: address });
    assert.equal(planning.actor.canPrint, true);
    assert.equal(planning.actor.canAllocate, false);
  }
});
test('verified indexed Referee can create, update and delete their canonical assignment', async () => {
  const data = assignment();
  await status(await write(data, email.toUpperCase()), 200);
  await status(await write({ ...data, lastChange: 2 }), 200);
  await status(await write(data, email, 'DELETE'), 200);
});
test('anonymous, unverified, foreign attendee and manager override cannot self-allocate for this attendee', async () => {
  for (const identity of [null, 'wc-other@example.com', 'wc-manager@example.com']) await status(await write(assignment(), identity), 403);
  await status(await write(assignment(), email, 'PATCH', false), 403);
});
test('role and linked account are independently checked after resolving the index', async () => {
  await db.doc(`attendee/${actorId}`).update({ roles: ['Coach'] });
  try { await status(await write(assignment()), 403); }
  finally { await db.doc(`attendee/${actorId}`).update({ roles: ['Referee'] }); }
  await db.doc(`person/${actorId}`).update({ userAuthId: 'someone-else' });
  try {
    await status(await write(assignment()), 403);
    assert.equal((await loadWaterCarrierPlanning('wc-t', undefined, { uid: email, email })).actor, null);
  } finally { await db.doc(`person/${actorId}`).update({ userAuthId: email }); }
});
test('missing and forged index entries cannot grant ownership', async () => {
  const reference = db.doc(`attendee-index/${attendeeIndexId('wc-t', email)}`);
  await reference.delete();
  await status(await write(assignment()), 403);
  await reference.set({ attendeeId: 'wc-other-ref' });
  await status(await write(assignment()), 403);
  await reference.set({ attendeeId: actorId });
});
test('API rejects hidden/non-current periods while own direct writes remain permitted', async () => {
  await db.doc('fragment-referee-allocation/wc-fragment').update({ visible: false });
  try {
    await status(await write(assignment()), 200);
    await status(await write(assignment(), email, 'DELETE'), 200);
    assert.equal((await fetch(`${apiUrl}&fragmentRefereeAllocationId=wc-fragment`)).status, 403);
  } finally { await db.doc('fragment-referee-allocation/wc-fragment').update({ visible: true }); }
  await db.doc('tournament-referee-allocation/wc-current').update({ current: false });
  try {
    assert.equal((await fetch(`${apiUrl}&fragmentRefereeAllocationId=wc-fragment`)).status, 403);
    await status(await write(assignment()), 200);
    await status(await write(assignment(), email, 'DELETE'), 200);
  }
  finally { await db.doc('tournament-referee-allocation/wc-current').update({ current: true }); }
});
test('canonical ID and invariant fields remain enforced; modules are checked by API/UI', async () => {
  for (const data of [assignment('wc-game', { id: 'random' }),
    assignment('wc-game', { half: 1 }), assignment('wc-game', { attendeePosition: 2 })]) {
    await status(await write(data), 403);
  }
  await db.doc('tournament/wc-t').update({ enablesModules: ['PRINTED_WATER_CARRIER'] });
  try {
    await status(await write(assignment()), 200);
    await status(await write(assignment(), email, 'DELETE'), 200);
    assert.equal((await loadWaterCarrierPlanning('wc-t')).matches.length, 0);
    const coach = 'wc-coach@example.com';
    assert.equal((await loadWaterCarrierPlanning('wc-t', undefined, { uid: coach, email: coach })).matches.length, 2);
  } finally { await db.doc('tournament/wc-t').update({ enablesModules: ['ONLINE_WATER_CARRIER', 'PRINTED_WATER_CARRIER'] }); }
});
test('role conversion and takeover of an existing assignment are rejected', async () => {
  const data = assignment();
  await status(await write(data), 200);
  await status(await write({ ...data, attendeeRole: 'Referee' }), 403);
  await status(await write({ ...data, attendeeId: 'wc-other-ref' }, 'wc-other@example.com'), 403);
  await status(await write({ ...data, gameId: 'wc-next' }), 403);
  await status(await write(data, 'wc-other@example.com', 'DELETE'), 403);
  await status(await write(data, email, 'DELETE'), 200);
});

test('private availability blocks overlapping slots without leaking attendee fields', async () => {
  await db.doc(`attendee/${actorId}`).update({ unavailabilities: [{ dayId: 'd1', unavailability: 'PARTIAL', unavailableSlotIds: ['s1'] }] });
  try {
    const result = await loadWaterCarrierPlanning('wc-t', undefined, { uid: email, email });
    assert.equal(result.actor.conflicts['wc-game'], 'Unavailable');
    assert.equal(result.actor.conflicts['wc-next'], 'Referee assignment');
    assert.doesNotMatch(JSON.stringify(result), /phone|personId|unavailableSlotIds/);
  } finally { await db.doc(`attendee/${actorId}`).update({ unavailabilities: [] }); }
});

test('authenticated HTTP context uses the verified token rather than query identity', async () => {
  const address = 'wc-other@example.com';
  await admin.auth().createUser({ uid: address, email: address, emailVerified: true, password: 'local-test-password' });
  const loginResponse = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-test`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: address, password: 'local-test-password', returnSecureToken: true }),
  });
  const login = await loginResponse.json();
  const response = await fetch(`${apiUrl}&attendeeId=wc-manager&email=wc-manager@example.com`, {
    headers: { Authorization: `Bearer ${login.idToken}` },
  });
  assert.equal(response.status, 200, response.status === 200 ? '' : await response.text());
  const result = await response.json();
  assert.equal(result.actor.attendeeId, 'wc-other-ref');
  assert.equal(result.actor.canPrint, false);
});

test('cross-tournament games and role conversion of existing referee records are denied', async () => {
  await db.doc('game/wc-foreign').set({ id: 'wc-foreign', tournamentId: 'other-t', dayId: 'd1', timeslotId: 's1', fieldId: 'field' });
  await status(await write(assignment('wc-foreign')), 403);
  const data = assignment();
  await db.doc(`game-attendee-allocation/${data.id}`).set({ ...data, attendeeRole: 'Referee' });
  try { await status(await write(data), 403); }
  finally { await db.doc(`game-attendee-allocation/${data.id}`).delete(); }
});
test('concurrent retries produce one record, and scheduling conflicts remain a frontend check', async () => {
  const data = assignment('wc-next');
  const responses = await Promise.all([write(data), write(data)]);
  for (const response of responses) await status(response, 200);
  const records = await db.collection('game-attendee-allocation').where('attendeeRole', '==', 'WaterCarrier').get();
  assert.equal(records.size, 1);
  await status(await write(data, email, 'DELETE'), 200);
});
test('shared fragment assignments can be deleted directly after changing the current allocation', async () => {
  const data = assignment();
  await status(await write(data), 200);
  await db.doc('tournament-referee-allocation/wc-new').set({ id: 'wc-new', tournamentId: 'wc-t', current: true,
    fragmentRefereeAllocations: [{ id: 'wc-fragment', dayId: 'd1', partDayId: 'p1' }] });
  await db.doc('tournament-referee-allocation/wc-current').update({ current: false });
  try {
    await status(await write(data, email, 'DELETE'), 200);
  } finally {
    await db.doc('tournament-referee-allocation/wc-new').delete();
    await db.doc('tournament-referee-allocation/wc-current').update({ current: true });
  }
});

test('game and fragment must exist in the same tournament; period correspondence is not enforced', async () => {
  for (const [fragmentId, tournamentId, dayId] of [
    ['wc-foreign-fragment', 'other-t', 'd1'], ['wc-mismatched-fragment', 'wc-t', 'another-day'],
  ]) await db.doc(`fragment-referee-allocation/${fragmentId}`).set({ id: fragmentId, tournamentId, dayId, visible: false });
  for (const fragmentId of ['wc-foreign-fragment', 'wc-missing-fragment', 'wc-mismatched-fragment']) {
    const data = assignment('wc-game', {
      id: waterCarrierAllocationId('wc-t', fragmentId, 'wc-game', actorId), fragmentRefereeAllocationId: fragmentId,
    });
    await status(await write(data), fragmentId === 'wc-mismatched-fragment' ? 200 : 403);
    if (fragmentId === 'wc-mismatched-fragment') {
      await status(await write({ ...data, lastChange: 2 }), 200);
      await status(await write(data, email, 'DELETE'), 200);
    }
  }
  await status(await write(assignment('wc-missing-game')), 403);
});
