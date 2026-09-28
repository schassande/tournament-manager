const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host || !/^(127\.0\.0\.1|localhost):\d+$/.test(host)) {
  throw new Error('Maintenance tests require the local Firestore emulator.');
}
const admin = require('../../functions/node_modules/firebase-admin');
const { maintainRanking } = require('../../functions/lib/functions/src/referee-ranking/maintenance');
admin.initializeApp({ projectId: 'demo-ranking-stage1' });
const db = admin.firestore();
const parents = db.collection('tournament-referee-ranking');
const children = db.collection('coach-referees-ranking');

/** Creates a callable context without bypassing the maintenance function's authentication checks. */
function request(id, ids, email = 'maintenance@example.com') {
  return { auth: { uid: 'maintainer', token: { email, email_verified: true } }, data: {
    tournamentId: 'maintenance', tournamentRefereeRankingId: id, actorCoachAttendeeId: 'maintainer',
    ...(ids ? { refereeAttendeeIds: ids } : {}),
  } };
}

/** Seeds independent parent and locked/practice fixtures for an atomic operation. */
async function seed(id, overrides = {}) {
  const ranking = { id, name: 'Finals', tournamentId: 'maintenance', lastChange: 1,
    selectedRefereeAttendeeIds: ['ma', 'mb', 'mc'], selectedCoachAttendeeIds: ['maintainer'],
    nbRefereesToRank: 15, voteMajority: 1, status: 'PANEL_RANKING', panelResultState: 'CURRENT',
    updatedByCoachAttendeeId: 'maintainer', panelRefereesRanking: {
      rankedRefereeAttendeeIds: ['mc', 'ma', 'mb'], stats: [{ ranks: [1] }, { ranks: [2, 2] }, { ranks: [3] }], rankingLastChange: 'old',
    }, ...overrides };
  const batch = db.batch().set(parents.doc(id), ranking);
  for (const [coach, ranked] of [['maintainer', ['mb', 'ma', 'mc']], ['practice', ['ma', 'mc']], ['unchanged', ['mc']]]) {
    batch.set(children.doc(`${id}-${coach}`), { id: `${id}-${coach}`, tournamentId: 'maintenance',
      tournamentRefereeRankingId: id, coachAttendeeId: coach, locked: true,
      rankedRefereeAttendeeIds: ranked, rankingLastChange: 'old', lastChange: 1 });
  }
  await batch.commit();
  return ranking;
}

/** Reads persisted documents for complete before/after comparisons. */
async function snapshot(id) {
  const parent = (await parents.doc(id).get()).data();
  const records = (await children.where('tournamentRefereeRankingId', '==', id).get()).docs.map((doc) => doc.data());
  return { parent, records };
}

before(async () => {
  const batch = db.batch();
  batch.set(db.doc('attendee-index/maintenance:maintenance@example.com'), { attendeeId: 'maintainer' });
  batch.set(db.doc('tournament/maintenance'), { enablesModules: ['RANKING'] });
  batch.set(db.doc('person/maintainer'), { email: 'maintenance@example.com' });
  batch.set(db.doc('attendee/maintainer'), { id: 'maintainer', tournamentId: 'maintenance', roles: ['Coach'], isRefereeCoach: true, person: { email: 'maintenance@example.com' } });
  for (const id of ['ma', 'mb', 'mc']) batch.set(db.doc(`attendee/${id}`), { tournamentId: 'maintenance', isReferee: true, roles: ['Referee'] });
  await batch.commit();
});
after(async () => { await db.terminate(); await admin.app().delete(); });

test('multi-removal commits aligned stats and cleans locked practice records without changing unaffected timestamps', async () => {
  await seed('atomic');
  const result = await maintainRanking(request('atomic', ['ma', 'mb']), true);
  assert.equal(result.changed, true);
  assert.deepEqual(result.ranking.selectedRefereeAttendeeIds, ['mc']);
  assert.deepEqual(result.ranking.panelRefereesRanking.stats, [[1]]);
  assert.deepEqual(result.ranking.panelRefereesRanking.rankedRefereeAttendeeIds, ['mc']);
  assert.equal(result.ranking.panelResultState, 'STALE');
  const persisted = await snapshot('atomic');
  assert.deepEqual(persisted.parent.panelRefereesRanking.stats, [{ ranks: [1] }]);
  for (const record of persisted.records) {
    assert.deepEqual(record.rankedRefereeAttendeeIds, ['mc']);
    assert.equal(record.locked, true);
    assert.equal(record.rankingLastChange === 'old', record.coachAttendeeId === 'unchanged');
  }
});

test('invalid selection, forged identity, and anonymous callers leave every document untouched', async () => {
  await seed('rejected');
  const initial = await snapshot('rejected');
  await assert.rejects(maintainRanking(request('rejected', ['ma', 'unselected']), true), { code: 'invalid-argument' });
  await assert.rejects(maintainRanking(request('rejected', ['ma'], 'outsider@example.com'), true), { code: 'permission-denied' });
  await assert.rejects(maintainRanking({ data: request('rejected').data }, false), { code: 'unauthenticated' });
  assert.deepEqual(await snapshot('rejected'), initial);
});

test('repair derives deleted and player referee eligibility from storage; CLOSED is strictly read-only', async () => {
  await seed('repair', { selectedRefereeAttendeeIds: ['ma', 'mb', 'mc', 'missing'] });
  await db.doc('attendee/mb').update({ roles: ['PlayerReferee'] });
  await db.doc('attendee/ma').update({ player: { teamId: 'team' } });
  try {
    const result = await maintainRanking(request('repair'), false);
    assert.deepEqual(result.ranking.selectedRefereeAttendeeIds, ['mc']);
    assert(result.coachRankings.every((record) => record.rankedRefereeAttendeeIds.join() === 'mc'));
    const again = await maintainRanking(request('repair'), false);
    assert.equal(again.changed, false);
    await seed('closed', { status: 'CLOSED' });
    const initial = await snapshot('closed');
    assert.equal((await maintainRanking(request('closed'), false)).changed, false);
    await assert.rejects(maintainRanking(request('closed', ['ma']), true), { code: 'failed-precondition' });
    assert.deepEqual(await snapshot('closed'), initial);
  } finally {
    await db.doc('attendee/mb').update({ roles: ['Referee'] });
    await db.doc('attendee/ma').update({ player: admin.firestore.FieldValue.delete() });
  }
});

test('a failed transaction commit does not persist the parent or any earlier queued child writes', async () => {
  await seed('failed-commit');
  const initial = await snapshot('failed-commit');
  const original = db.runTransaction.bind(db);
  // Inject a failing precondition after maintenance has queued its writes, then use the real emulator commit.
  db.runTransaction = (operation) => original(async (transaction) => {
    const result = await operation(transaction);
    transaction.update(db.doc('missing-ranking-test/does-not-exist'), { fail: true });
    return result;
  });
  try {
    await assert.rejects(maintainRanking(request('failed-commit', ['ma']), true));
  } finally { db.runTransaction = original; }
  assert.deepEqual(await snapshot('failed-commit'), initial);
});

test('maintenance preserves delegated editor and target metadata without inventing legacy actors', async () => {
  await seed('delegated-metadata', { updatedCoachAttendeeId: 'practice' });
  await children.doc('delegated-metadata-practice').update({ updatedByCoachAttendeeId: 'previous-editor' });
  const result = await maintainRanking(request('delegated-metadata', ['ma']), true);
  assert.equal(result.ranking.updatedCoachAttendeeId, 'practice');
  assert.equal(result.coachRankings.find(record => record.coachAttendeeId === 'practice').updatedByCoachAttendeeId, 'previous-editor');
  assert.equal(result.coachRankings.find(record => record.coachAttendeeId === 'maintainer').updatedByCoachAttendeeId, undefined);
  const persisted = await snapshot('delegated-metadata');
  assert.equal(persisted.parent.updatedCoachAttendeeId, 'practice');
  assert.equal(persisted.records.find(record => record.coachAttendeeId === 'practice').updatedByCoachAttendeeId, 'previous-editor');
});

test('standalone deletion removes CLOSED and practice records, preserving unrelated rankings', async () => {
  const { deleteRanking } = require('../../functions/lib/functions/src/referee-ranking/delete-referee-ranking');
  await seed('delete-closed', { status: 'CLOSED' });
  await seed('delete-unrelated');
  const original = await snapshot('delete-unrelated');
  assert.deepEqual(await deleteRanking(request('delete-closed')), { deletedRankingId: 'delete-closed', deletedCoachRankingCount: 3 });
  assert.deepEqual(await snapshot('delete-closed'), { parent: undefined, records: [] });
  assert.deepEqual(await snapshot('delete-unrelated'), original);
});

test('standalone deletion validates authentication, module, tournament and relationship before deleting', async () => {
  const { deleteRanking } = require('../../functions/lib/functions/src/referee-ranking/delete-referee-ranking');
  await seed('delete-denied');
  const original = await snapshot('delete-denied');
  await assert.rejects(deleteRanking({ data: request('delete-denied').data }), { code: 'unauthenticated' });
  await assert.rejects(deleteRanking(request('delete-denied', undefined, 'manager@example.com')), { code: 'permission-denied' });
  await assert.rejects(deleteRanking(request('../invalid')), { code: 'invalid-argument' });
  await assert.rejects(deleteRanking(request('absent-ranking')), { code: 'not-found' });
  await db.doc('tournament/maintenance').update({ enablesModules: [] });
  try { await assert.rejects(deleteRanking(request('delete-denied')), { code: 'permission-denied' }); }
  finally { await db.doc('tournament/maintenance').update({ enablesModules: ['RANKING'] }); }
  assert.deepEqual(await snapshot('delete-denied'), original);
  await children.doc('delete-denied-practice').update({ tournamentId: 'foreign' });
  await assert.rejects(deleteRanking(request('delete-denied')), { code: 'failed-precondition' });
  assert.equal((await snapshot('delete-denied')).records.length, 3);
});

test('standalone cascade retries after a real failed batch without deleting its parent early', async () => {
  const { deleteRanking } = require('../../functions/lib/functions/src/referee-ranking/delete-referee-ranking');
  await seed('delete-retry');
  const extra = db.batch();
  for (let index = 0; index < 500; index++) extra.set(children.doc(`delete-retry-extra-${index}`), {
    tournamentId: 'maintenance', tournamentRefereeRankingId: 'delete-retry', coachAttendeeId: `practice-${index}`,
  });
  await extra.commit();
  const original = db.batch.bind(db);
  let batchNumber = 0;
  db.batch = () => {
    const batch = original();
    const originalDelete = batch.delete.bind(batch);
    let counted = false;
    batch.delete = (...args) => {
      if (!counted) {
        counted = true;
        if (++batchNumber === 2) batch.update(db.doc('missing-ranking-test/delete-failure'), { fail: true });
      }
      return originalDelete(...args);
    };
    return batch;
  };
  try { await assert.rejects(deleteRanking(request('delete-retry')), { code: 'internal' }); }
  finally { db.batch = original; }
  const partial = await snapshot('delete-retry');
  assert(partial.parent);
  assert.equal(partial.records.length, 3);
  assert.equal((await deleteRanking(request('delete-retry'))).deletedCoachRankingCount, 3);
  assert.deepEqual(await snapshot('delete-retry'), { parent: undefined, records: [] });
});
