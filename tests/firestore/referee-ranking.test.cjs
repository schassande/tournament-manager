const assert = require('node:assert/strict');
const { before, test } = require('node:test');

const project = 'demo-ranking-stage1';
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host || !/^(127\.0\.0\.1|localhost):\d+$/.test(host)) {
  throw new Error('These tests require a local Firestore emulator; production access is forbidden.');
}
const base = `http://${host}/v1/projects/${project}/databases/(default)/documents`;

/** Encodes a JSON fixture into the Firestore REST value representation. */
function value(data) {
  if (Array.isArray(data)) return { arrayValue: { values: data.map(value) } };
  if (data === null) return { nullValue: null };
  if (typeof data === 'object') return { mapValue: { fields: fields(data) } };
  if (typeof data === 'boolean') return { booleanValue: data };
  if (typeof data === 'number') return Number.isInteger(data) ? { integerValue: String(data) } : { doubleValue: data };
  return { stringValue: data };
}

/** Encodes the named fields of a fixture document. */
function fields(data) {
  return Object.fromEntries(Object.entries(data).map(([key, item]) => [key, value(item)]));
}

/** Builds an unsigned identity token accepted only by the local emulator. */
function token(email) {
  const now = Math.floor(Date.now() / 1000);
  const encode = data => Buffer.from(JSON.stringify(data)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
    iss: `https://securetoken.google.com/${project}`, aud: project, sub: email,
    user_id: email, email, email_verified: true, iat: now, exp: now + 3600, auth_time: now,
    firebase: { sign_in_provider: 'custom', identities: {} },
  })}.`;
}

/** Sends a local REST request, using owner only for explicit fixture setup. */
async function request(path, identity, method = 'GET', body) {
  const headers = { 'Content-Type': 'application/json' };
  if (identity) headers.Authorization = `Bearer ${identity === 'owner' ? identity : token(identity)}`;
  return fetch(`${base}/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
}

/** Persists a complete fixture or attempted client write. */
async function put(path, data, identity = 'owner') {
  return request(path, identity, 'PATCH', { fields: fields(data) });
}

/** Creates the stage-one parent fixture independently of implementation helpers. */
function ranking(id, overrides = {}) {
  return {
    id, lastChange: 1, name: 'Finals', tournamentId: 't', updatedByCoachAttendeeId: 'coach',
    selectedRefereeAttendeeIds: [], selectedCoachAttendeeIds: [], nbRefereesToRank: 15, voteMajority: 1,
    status: 'CONFIGURE', panelResultState: 'NOT_COMPUTED',
    panelRefereesRanking: { rankingLastChange: '', rankedRefereeAttendeeIds: [], stats: [] },
    ...overrides,
  };
}

/** Asserts a response and includes diagnostic text on unexpected statuses. */
async function status(response, expected) {
  assert.equal(response.status, expected, await response.text());
}

before(async () => {
  await status(await put('tournament/t', { managerEmails: ['manager@example.com'], enablesModules: ['RANKING'] }), 200);
  await status(await put('person/p', { email: 'coach@example.com' }), 200);
  await status(await put('attendee/coach', { tournamentId: 't', isRefereeCoach: true, person: { personId: 'p' } }), 200);
  await status(await put('tournament-referee-ranking/existing', ranking('existing')), 200);
  await status(await put('coach-referees-ranking/existing', { tournamentId: 't' }), 200);
});

test('both collections allow outsider authenticated reads and deny anonymous reads', async () => {
  for (const collection of ['tournament-referee-ranking', 'coach-referees-ranking']) {
    await status(await request(`${collection}/existing`, 'outsider@example.com'), 200);
    await status(await request(`${collection}/existing`, null), 403);
    await status(await request(collection, 'outsider@example.com'), 200);
  }
});

test('a real tournament coach can create, using the nested person reference', async () => {
  await status(await put('tournament-referee-ranking/created', ranking('created'), 'coach@example.com'), 200);
});

test('outsiders and manager-only users cannot impersonate a coach', async () => {
  for (const identity of ['outsider@example.com', 'manager@example.com']) {
    await status(await put('tournament-referee-ranking/forged', ranking('forged'), identity), 403);
  }
});

test('creation rejects blank names, precomputed results and selected data before tab stages', async () => {
  for (const changes of [{ name: '   ' }, { panelResultState: 'CURRENT' }, { selectedCoachAttendeeIds: ['coach'] }]) {
    await status(await put('tournament-referee-ranking/invalid', ranking('invalid', changes), 'coach@example.com'), 403);
  }
});

test('a coach cannot create for a different tournament or when the module is disabled', async () => {
  await status(await put('tournament-referee-ranking/cross', ranking('cross', { tournamentId: 'other' }), 'coach@example.com'), 403);
  await status(await put('tournament/off', { managerEmails: [], enablesModules: [] }), 200);
  await status(await put('attendee/off-coach', { tournamentId: 'off', isRefereeCoach: true, person: { personId: 'p' } }), 200);
  await status(await put('tournament-referee-ranking/off', ranking('off', {
    tournamentId: 'off', updatedByCoachAttendeeId: 'off-coach',
  }), 'coach@example.com'), 403);
});

test('legal transitions work without panel membership; combined status/config changes do not', async () => {
  const initial = ranking('transition');
  await status(await put('tournament-referee-ranking/transition', initial), 200);
  const individual = { ...initial, status: 'INDIVIDUAL_RANKING', lastChange: 2 };
  await status(await put('tournament-referee-ranking/transition', individual, 'coach@example.com'), 200);
  const panel = { ...individual, status: 'PANEL_RANKING', lastChange: 3 };
  await status(await put('tournament-referee-ranking/transition', panel, 'coach@example.com'), 200);
  await status(await put('tournament-referee-ranking/transition', { ...panel, status: 'CLOSED' }, 'coach@example.com'), 403);
  await status(await put('tournament-referee-ranking/transition', { ...individual, name: 'Changed' }, 'coach@example.com'), 403);
  await status(await put('tournament-referee-ranking/transition', individual, 'coach@example.com'), 200);
});

test('Referees edits validate name and N, preserve unrelated data, and deny client removals', async () => {
  const initial = ranking('referees', { selectedRefereeAttendeeIds: ['a'] });
  await status(await put('tournament-referee-ranking/referees', initial), 200);
  const edited = { ...initial, name: 'Renamed', nbRefereesToRank: 30, selectedRefereeAttendeeIds: ['a', 'b'] };
  await status(await put('tournament-referee-ranking/referees', edited, 'coach@example.com'), 200);
  for (const changes of [{ name: '  ' }, { nbRefereesToRank: 0 }, { nbRefereesToRank: 1.5 },
    { nbRefereesToRank: 9007199254740992 }, { selectedRefereeAttendeeIds: ['b'] },
    { selectedRefereeAttendeeIds: ['a', 'b', 'b'] }, { voteMajority: 2 }, { selectedCoachAttendeeIds: ['coach'] }]) {
    await status(await put('tournament-referee-ranking/referees', { ...edited, ...changes }, 'coach@example.com'), 403);
  }
  await status(await put('tournament-referee-ranking/referees', { ...edited, name: 'Forged' }, 'outsider@example.com'), 403);
  await status(await put('tournament-referee-ranking/referees', { ...edited, status: 'CLOSED' }), 200);
  await status(await put('tournament-referee-ranking/referees', { ...edited, status: 'CLOSED', name: 'No' }, 'coach@example.com'), 403);
});

test('selection additions invalidate computed results but metadata edits preserve freshness', async () => {
  const initial = ranking('freshness', { panelResultState: 'CURRENT', selectedRefereeAttendeeIds: ['a'],
    panelRefereesRanking: { rankingLastChange: 'computed', rankedRefereeAttendeeIds: ['a'], stats: [{ ranks: [1] }] } });
  await status(await put('tournament-referee-ranking/freshness', initial), 200);
  const renamed = { ...initial, name: 'Renamed', nbRefereesToRank: 50 };
  await status(await put('tournament-referee-ranking/freshness', renamed, 'coach@example.com'), 200);
  const added = { ...renamed, selectedRefereeAttendeeIds: ['a', 'b'] };
  await status(await put('tournament-referee-ranking/freshness', added, 'coach@example.com'), 403);
  await status(await put('tournament-referee-ranking/freshness', { ...added, panelResultState: 'STALE' }, 'coach@example.com'), 200);
});

test('stale results cannot close; current computed empty results can close and never reopen', async () => {
  for (const state of ['STALE', 'CURRENT']) {
    const data = ranking(state, { status: 'PANEL_RANKING', panelResultState: state,
      panelRefereesRanking: { rankingLastChange: '2026-09-12T12:00:00Z', rankedRefereeAttendeeIds: [], stats: [] },
    });
    await status(await put(`tournament-referee-ranking/${state}`, data), 200);
    await status(await put(`tournament-referee-ranking/${state}`, { ...data, status: 'CLOSED' }, 'coach@example.com'), state === 'CURRENT' ? 200 : 403);
    if (state === 'CURRENT') {
      await status(await put(`tournament-referee-ranking/${state}`, data, 'coach@example.com'), 403);
    }
  }
});

test('individual writes stay closed until the Me stage', async () => {
  await status(await put('coach-referees-ranking/unavailable', { tournamentId: 't' }, 'coach@example.com'), 403);
});

test('manager cascade deletes use tournament identity even without attendees; other users cannot delete', async () => {
  for (const collection of ['tournament-referee-ranking', 'coach-referees-ranking']) {
    await status(await put(`${collection}/cascade`, { tournamentId: 't' }), 200);
    await status(await request(`${collection}/cascade`, 'coach@example.com', 'DELETE'), 403);
    await status(await request(`${collection}/cascade`, 'outsider@example.com', 'DELETE'), 403);
    await status(await request(`${collection}/cascade`, 'manager@example.com', 'DELETE'), 200);
  }
});
