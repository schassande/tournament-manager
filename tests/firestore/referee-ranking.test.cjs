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
  return fetch(`${base}/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000),
  });
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
    { selectedRefereeAttendeeIds: ['a', 'b', 'b'] }]) {
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

test('coach membership and majority edits preserve individual votes and stale computed output in every open phase', async () => {
  const vote = { tournamentId: 't', tournamentRefereeRankingId: 'coaches', coachAttendeeId: 'coach',
    locked: true, rankedRefereeAttendeeIds: ['a'], rankingLastChange: 'original', lastChange: 1 };
  await status(await put('coach-referees-ranking/coaches-vote', vote), 200);
  const before = await (await request('coach-referees-ranking/coaches-vote', 'coach@example.com')).json();
  for (const phase of ['CONFIGURE', 'INDIVIDUAL_RANKING', 'PANEL_RANKING']) {
    const initial = ranking('coaches', { status: phase, selectedCoachAttendeeIds: ['coach'], voteMajority: 5,
      panelResultState: 'CURRENT', panelRefereesRanking: { rankingLastChange: 'computed', rankedRefereeAttendeeIds: ['a'], stats: [{ ranks: [1] }] } });
    await status(await put('tournament-referee-ranking/coaches', initial), 200);
    const removed = { ...initial, selectedCoachAttendeeIds: [] };
    await status(await put('tournament-referee-ranking/coaches', removed, 'coach@example.com'), 403);
    const stale = { ...removed, panelResultState: 'STALE' };
    await status(await put('tournament-referee-ranking/coaches', stale, 'coach@example.com'), 200);
    await status(await put('tournament-referee-ranking/coaches', { ...stale, voteMajority: 51 }, 'coach@example.com'), 200);
    await status(await put('tournament-referee-ranking/coaches', { ...stale, selectedCoachAttendeeIds: ['coach'] }, 'coach@example.com'), 200);
  }
  assert.deepEqual(await (await request('coach-referees-ranking/coaches-vote', 'coach@example.com')).json(), before);
});

test('coach edits enforce positive safe majority, unique membership, access, CLOSED and exact freshness', async () => {
  const initial = ranking('coach-validation');
  await status(await put('tournament-referee-ranking/coach-validation', initial), 200);
  for (const changes of [{ voteMajority: 0 }, { voteMajority: -1 }, { voteMajority: 1.5 },
    { voteMajority: '2' }, { voteMajority: null }, { voteMajority: 9007199254740992 },
    { selectedCoachAttendeeIds: ['coach', 'coach'] }, { selectedCoachAttendeeIds: 'coach' },
    { voteMajority: 2, panelResultState: 'CURRENT' }]) {
    await status(await put('tournament-referee-ranking/coach-validation', { ...initial, ...changes }, 'coach@example.com'), 403);
  }
  const edited = { ...initial, selectedCoachAttendeeIds: ['coach'], voteMajority: 9007199254740991 };
  for (const actor of [null, 'outsider@example.com', 'manager@example.com']) {
    await status(await put('tournament-referee-ranking/coach-validation', edited, actor), 403);
  }
  await status(await put('tournament-referee-ranking/coach-validation', edited, 'coach@example.com'), 200);
  const computed = { ...edited, panelResultState: 'CURRENT' };
  await status(await put('tournament-referee-ranking/coach-validation', computed), 200);
  await status(await put('tournament-referee-ranking/coach-validation', { ...computed, voteMajority: 3 }, 'coach@example.com'), 403);
  await status(await put('tournament-referee-ranking/coach-validation', { ...computed, voteMajority: 3, panelResultState: 'STALE' }, 'coach@example.com'), 200);
  const closed = { ...edited, status: 'CLOSED' };
  await status(await put('tournament-referee-ranking/coach-validation', closed), 200);
  await status(await put('tournament-referee-ranking/coach-validation', { ...closed, voteMajority: 2 }, 'coach@example.com'), 403);
});

test('malformed individual writes are rejected', async () => {
  await status(await put('coach-referees-ranking/unavailable', { tournamentId: 't' }, 'coach@example.com'), 403);
});

/** Builds a dense owner fixture independently of the shared implementation. */
function individualVote(parentId, coach = 'coach', overrides = {}) {
  return { id: `${parentId}|${coach}`, tournamentId: 't', tournamentRefereeRankingId: parentId, coachAttendeeId: coach,
    rankedRefereeAttendeeIds: ['a'], locked: false, lastChange: 1, rankingLastChange: '2026-09-12T12:00:00Z', ...overrides };
}

/** Commits a vote and narrow parent update through client rules, never through Admin SDK. */
async function voteBatch(vote, parentPatch, actor = 'coach@example.com') {
  const parentId = vote.tournamentRefereeRankingId;
  const prefix = `projects/${project}/databases/(default)/documents/`;
  const writes = [{ update: { name: `${prefix}coach-referees-ranking/${vote.id}`, fields: fields(vote) } }];
  if (parentPatch) writes.push({ update: { name: `${prefix}tournament-referee-ranking/${parentId}`, fields: fields(parentPatch) },
    updateMask: { fieldPaths: Object.keys(parentPatch) } });
  return fetch(`${base}:commit`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token(actor)}` }, body: JSON.stringify({ writes }) });
}

test('owners create and reorder dense votes in both active phases, including non-panel practice', async () => {
  await status(await put('person/other-owner', { email: 'other-coach@example.com' }), 200);
  await status(await put('attendee/other-owner', { tournamentId: 't', isRefereeCoach: true, person: { personId: 'other-owner' } }), 200);
  for (const phase of ['INDIVIDUAL_RANKING', 'PANEL_RANKING']) {
    const id = `me-${phase}`;
    await status(await put(`tournament-referee-ranking/${id}`, ranking(id, { status: phase, selectedRefereeAttendeeIds: ['a', 'b'] })), 200);
    const vote = individualVote(id);
    await status(await voteBatch(vote), 200);
    const reordered = { ...vote, rankedRefereeAttendeeIds: ['b', 'a'], rankingLastChange: '2026-09-12T12:01:00Z', lastChange: 2 };
    await status(await voteBatch(reordered), 200);
    for (const changes of [{ rankedRefereeAttendeeIds: ['a', 'a'] }, { rankedRefereeAttendeeIds: ['missing'] },
      { id: 'wrong-id' }, { tournamentId: 'other' }, { coachAttendeeId: 'other' }]) {
      await status(await voteBatch({ ...reordered, ...changes }), 403);
    }
    await status(await voteBatch({ ...reordered, locked: true }, null, 'outsider@example.com'), 403);
    await status(await voteBatch({ ...reordered, locked: true }, null, 'other-coach@example.com'), 403);
    await status(await voteBatch({ ...reordered, locked: true }), 200);
    await status(await voteBatch({ ...reordered, locked: true, rankedRefereeAttendeeIds: [] }), 403);
    await status(await voteBatch({ ...reordered, locked: false, rankedRefereeAttendeeIds: [] }), 403);
    await status(await voteBatch({ ...reordered, locked: false }), 200);
  }
});

test('selected coach locks require atomic staleness; failed batches change neither document', async () => {
  const parent = ranking('me-atomic', { status: 'PANEL_RANKING', selectedCoachAttendeeIds: ['coach'],
    selectedRefereeAttendeeIds: ['a'], panelResultState: 'CURRENT',
    panelRefereesRanking: { rankedRefereeAttendeeIds: ['a'], stats: [{ ranks: [1] }], rankingLastChange: 'computed' } });
  await status(await put('tournament-referee-ranking/me-atomic', parent), 200);
  const vote = individualVote(parent.id);
  await status(await voteBatch(vote), 200);
  const before = await (await request(`coach-referees-ranking/${vote.id}`, 'coach@example.com')).json();
  await status(await voteBatch({ ...vote, locked: true }), 403);
  assert.deepEqual(await (await request(`coach-referees-ranking/${vote.id}`, 'coach@example.com')).json(), before);
  const stale = { panelResultState: 'STALE', updatedByCoachAttendeeId: 'coach', lastChange: 2 };
  await status(await voteBatch({ ...vote, locked: true }, { ...stale, name: 'forged' }), 403);
  assert.deepEqual(await (await request(`coach-referees-ranking/${vote.id}`, 'coach@example.com')).json(), before);
  await status(await voteBatch({ ...vote, locked: true }, stale), 200);
  const saved = await (await request('tournament-referee-ranking/me-atomic', 'coach@example.com')).json();
  assert.deepEqual(saved.fields.panelRefereesRanking, value(parent.panelRefereesRanking));
  assert.equal(saved.fields.panelResultState.stringValue, 'STALE');
  await status(await voteBatch({ ...vote, locked: false }), 200);
});

test('empty lock creation can dirty a result but practice and standalone freshness writes cannot', async () => {
  for (const selected of [true, false]) {
    const id = `me-empty-${selected}`;
    const parent = ranking(id, { status: 'PANEL_RANKING', selectedCoachAttendeeIds: selected ? ['coach'] : [],
      selectedRefereeAttendeeIds: ['a'], panelResultState: 'CURRENT' });
    await status(await put(`tournament-referee-ranking/${id}`, parent), 200);
    const stale = { panelResultState: 'STALE', updatedByCoachAttendeeId: 'coach', lastChange: 2 };
    await status(await put(`tournament-referee-ranking/${id}`, { ...parent, ...stale }, 'coach@example.com'), 403);
    const vote = individualVote(id, 'coach', { locked: true, rankedRefereeAttendeeIds: [] });
    if (!selected) await status(await voteBatch(vote, stale), 403);
    await status(await voteBatch(vote, selected ? stale : null), 200);
  }
});

test('individual writes require an existing open parent, active module and immutable ranking time on lock-only writes', async () => {
  for (const phase of ['CONFIGURE', 'CLOSED']) {
    const id = `me-closed-${phase}`;
    await status(await put(`tournament-referee-ranking/${id}`, ranking(id, { status: phase, selectedRefereeAttendeeIds: ['a'] })), 200);
    await status(await voteBatch(individualVote(id)), 403);
  }
  await status(await voteBatch(individualVote('no-parent')), 403);
  const id = 'me-time';
  await status(await put(`tournament-referee-ranking/${id}`, ranking(id, { status: 'INDIVIDUAL_RANKING', selectedRefereeAttendeeIds: ['a'] })), 200);
  const vote = individualVote(id);
  await status(await voteBatch(vote), 200);
  await status(await voteBatch({ ...vote, locked: true, rankingLastChange: 'changed' }), 403);
  await status(await put('tournament/t', { managerEmails: ['manager@example.com'], enablesModules: [] }), 200);
  await status(await voteBatch({ ...vote, locked: true }), 403);
  await status(await put('tournament/t', { managerEmails: ['manager@example.com'], enablesModules: ['RANKING'] }), 200);
});

test('encoded pair identities preserve Unicode and reject colliding percent/separator aliases', async () => {
  const parentId = 'é%|ranking';
  const coachId = 'é%|coach';
  await status(await put(`attendee/${coachId}`, { tournamentId: 't', isRefereeCoach: true, person: { personId: 'p' } }), 200);
  await status(await put(`tournament-referee-ranking/${parentId}`, ranking(parentId, {
    status: 'INDIVIDUAL_RANKING', selectedRefereeAttendeeIds: ['a'], selectedCoachAttendeeIds: [coachId], panelResultState: 'CURRENT',
  })), 200);
  const vote = individualVote(parentId, coachId, { id: 'é%25%7Cranking|é%25%7Ccoach', locked: true });
  await status(await voteBatch(vote, { panelResultState: 'STALE', updatedByCoachAttendeeId: coachId, lastChange: 2 }), 200);
  await status(await voteBatch({ ...vote, id: `${parentId}|${coachId}` }), 403);
  await status(await voteBatch({ ...vote, id: 'é%7Cranking|é%7Ccoach' }), 403);
});

test('manager cascade deletes use tournament identity even without attendees; other users cannot delete', async () => {
  for (const collection of ['tournament-referee-ranking', 'coach-referees-ranking']) {
    await status(await put(`${collection}/cascade`, { tournamentId: 't' }), 200);
    await status(await request(`${collection}/cascade`, 'coach@example.com', 'DELETE'), 403);
    await status(await request(`${collection}/cascade`, 'outsider@example.com', 'DELETE'), 403);
    await status(await request(`${collection}/cascade`, 'manager@example.com', 'DELETE'), 200);
  }
});
