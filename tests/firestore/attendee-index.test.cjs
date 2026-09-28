const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
for (const name of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) {
  if (!/^(localhost|127\.0\.0\.1):\d+$/.test(process.env[name] || '')) throw new Error(`Local ${name} required.`);
}
const admin = require('../../functions/node_modules/firebase-admin');
const { saveAttendeeHandler, deleteAttendeeHandler } = require('../../functions/lib/functions/src/attendee/mutations');
const { createPersonHandler } = require('../../functions/lib/functions/src/person/create-person');
const { deletePersonHandler } = require('../../functions/lib/functions/src/person/delete-person');
const { linkPersonAttendees } = require('../../functions/lib/functions/src/person/link-attendees');
const { authorizeStatistics } = require('../../functions/lib/functions/src/identity/statistics-authorization');
const { createTournamentHandler } = require('../../functions/lib/functions/src/tournament/create-tournament');
const { deleteTournamentHandler } = require('../../functions/lib/functions/src/tournament/delete-tournament');
const { attendeeIndexId, attendeeRoleFlags } = require('../../functions/lib/persistent-data-model/src/attendee-index');
const project = 'demo-ranking-stage1';
admin.initializeApp({ projectId: project });
const db = admin.firestore();

/** Minimal verified callable fixture; no client ownership fields are trusted by handlers. */
function context(data, email = 'identity-manager@example.com', uid = email, verified = true) {
  return { auth: { uid, token: { email, email_verified: verified } }, data };
}
/** New participant fixture with deliberately forged flags that the server must derive. */
function attendee(email, tournamentId = 'identity-t') {
  return { id: '', lastChange: 1, tournamentId, roles: ['Referee'], isTournamentManager: true,
    isPlayer: true, isReferee: false, isRefereeCoach: true,
    person: { email, firstName: 'Test', lastName: 'Participant', shortName: 'TP', regionId: '', countryId: '' } };
}
/** Profile fixture including an explicitly authenticated owner. */
function person(email, uid = email) {
  return { id: '', lastChange: 1, email, userAuthId: uid, firstName: 'Test', lastName: 'User',
    shortName: 'TU', regionId: 'Europe', countryId: 'FRA' };
}

before(async () => {
  for (const id of ['identity-t', 'identity-other']) {
    await db.doc(`tournament/${id}`).set({ id, managerEmails: ['legacy@example.com'], enablesModules: ['RANKING'] });
    await db.doc(`attendee/${id}-manager`).set({ ...attendee('identity-manager@example.com', id),
      id: `${id}-manager`, roles: ['TournamentManager'], ...attendeeRoleFlags(['TournamentManager']) });
    await db.doc(`attendee-index/${id}:identity-manager@example.com`).set({ attendeeId: `${id}-manager` });
  }
  await db.doc('PlaformAdmin/identity-admin@example.com').set({});
});
after(async () => { await db.terminate(); await admin.app().delete(); });

test('index normalization and delimiter escaping do not collide', () => {
  assert.equal(attendeeIndexId('t:1', ' A/B:%@Example.com '), 't%3A1:a%2Fb%3A%25@example.com');
  assert.notEqual(attendeeIndexId('t:1', 'x@y'), attendeeIndexId('t', '1:x@y'));
  assert.equal(attendeeRoleFlags(['PlayerCoachReferee']).isRefereeCoach, true);
});

test('statistics authorize indexed managers and validate target tournaments', async () => {
  await db.doc('tournament-referee-allocation/identity-allocation').set({ tournamentId: 'identity-t' });
  await db.doc('fragment-referee-allocation/identity-fragment').set({ tournamentId: 'identity-t' });
  const manager = { uid: 'manager', email: 'identity-manager@example.com' };
  await authorizeStatistics(manager, 'identity-allocation', 'identity-fragment', [], '');
  await assert.rejects(authorizeStatistics({ uid: 'other', email: 'outsider@example.com' },
    'identity-allocation', 'identity-fragment', [], ''), { code: 'permission-denied' });
  await assert.rejects(authorizeStatistics(manager, 'identity-allocation', 'identity-fragment', ['identity-other-manager'], ''), { code: 'permission-denied' });

});

test('statistics HTTP endpoint rejects anonymous/unverified users and accepts an authenticated indexed manager', async () => {
  const { createRequire } = require('node:module');
  const backendRequire = createRequire(require.resolve('../../functions/lib/functions/src/allocation-statistics'));
  const express = backendRequire('express');
  const app = express();
  app.use(require('../../functions/lib/functions/src/allocation-statistics').allocationStatisticsRouter);
  const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const url = `http://127.0.0.1:${server.address().port}/compute?tournamentAllocationId=identity-allocation&fragmentAllocationId=identity-fragment`;
  try {
    assert.equal((await fetch(url)).status, 401);
    for (const [email, verified, expected] of [['http-unverified@example.com', false, 403],
      ['identity-manager@example.com', true, 200], ['http-outsider@example.com', true, 403]]) {
      await admin.auth().createUser({ email, password: 'local-test-password', emailVerified: verified });
      const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-test`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'local-test-password', returnSecureToken: true }),
      });
      const login = await response.json();
      const result = await fetch(url, { headers: { Authorization: `Bearer ${login.idToken}` } });
      assert.equal(result.status, expected, await result.text());
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('email-less attendees coexist and email removal clears only the current index', async () => {
  const first = await saveAttendeeHandler(context({ attendee: attendee('') }));
  const second = await saveAttendeeHandler(context({ attendee: attendee('') }));
  assert.notEqual(first.id, second.id);
  const assigned = await saveAttendeeHandler(context({ attendee: { ...first,
    person: { ...first.person, email: 'temporary@example.com' } } }));
  await saveAttendeeHandler(context({ attendee: { ...assigned, person: { ...assigned.person, email: '' } } }));
  assert.equal((await db.doc('attendee-index/identity-t:temporary@example.com').get()).exists, false);
});

test('concurrent creation enforces uniqueness and derives role flags', async () => {
  const attempts = await Promise.allSettled([1, 2].map(() => saveAttendeeHandler(context({ attendee: attendee(' Mixed@Example.com ') }))));
  assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(attempts.find(result => result.status === 'rejected').reason.code, 'already-exists');
  const saved = attempts.find(result => result.status === 'fulfilled').value;
  assert.equal(saved.person.email, 'mixed@example.com');
  assert.equal(saved.isTournamentManager, false);
  assert.equal(saved.isReferee, true);
  assert.equal(saved.isPlayer, false);
  assert.equal((await db.doc('attendee-index/identity-t:mixed@example.com').get()).data().attendeeId, saved.id);
  await saveAttendeeHandler(context({ attendee: attendee('mixed@example.com', 'identity-other') }));
  const changed = await saveAttendeeHandler(context({ attendee: { ...saved, person: { ...saved.person, email: 'new@example.com' } } }));
  assert.equal((await db.doc('attendee-index/identity-t:mixed@example.com').get()).exists, false);
  await deleteAttendeeHandler(context({ id: changed.id }));
  assert.equal((await db.doc('attendee-index/identity-t:new@example.com').get()).exists, false);
});

test('actor email must be verified and indexed; legacy managerEmails and forged tournament changes grant nothing', async () => {
  for (const request of [context({ attendee: attendee('denied@example.com') }, 'legacy@example.com'),
    context({ attendee: attendee('denied@example.com') }, 'identity-manager@example.com', undefined, false),
    { data: { attendee: attendee('denied@example.com') } }]) {
    await assert.rejects(saveAttendeeHandler(request), error => ['permission-denied', 'unauthenticated'].includes(error.code));
  }
  const saved = await saveAttendeeHandler(context({ attendee: attendee('immutable@example.com') }));
  await assert.rejects(saveAttendeeHandler(context({ attendee: { ...saved, tournamentId: 'identity-other' } })), { code: 'permission-denied' });
  const collision = await saveAttendeeHandler(context({ attendee: attendee('collision@example.com') }));
  await assert.rejects(saveAttendeeHandler(context({ attendee: { ...saved, person: { ...saved.person, email: collision.person.email } } })), { code: 'already-exists' });
  assert.equal((await db.doc(`attendee/${saved.id}`).get()).data().person.email, 'immutable@example.com');
});

test('self-registration links more than one batch across tournaments, replaces stale links, and retries safely', async () => {
  const email = 'registration@example.com';
  for (let offset = 0; offset < 505; offset += 200) {
    const batch = db.batch();
    for (let i = offset; i < Math.min(offset + 200, 505); i++) {
      batch.set(db.doc(`attendee/registration-${String(i).padStart(4, '0')}`), {
        ...attendee(email, `registration-t${i}`),
        person: { ...attendee(email).person, personId: 'deleted-person' },
      });
    }
    await batch.commit();
  }
  const saved = await createPersonHandler(context({ person: person(email) }, email));
  const again = await createPersonHandler(context({ person: person(email) }, email));
  assert.equal(saved.id, again.id);
  const matches = await db.collection('attendee').where('person.personId', '==', saved.id).get();
  assert.equal(matches.size, 505);
  assert.equal(matches.docs[1].data().person.email, email);
  assert.deepEqual(matches.docs[0].data().roles, ['Referee']);
  const noMatches = await createPersonHandler(context({ person: person('no-matches@example.com') }, 'no-matches@example.com'));
  assert.ok(noMatches.id);
  await assert.rejects(createPersonHandler(context({ person: person(email) }, 'identity-admin@example.com')), { code: 'permission-denied' });
  await assert.rejects(createPersonHandler(context({ person: person('unverified@example.com') }, 'unverified@example.com', undefined, false)), { code: 'permission-denied' });
});

test('registration linking reads only attendees selected by normalized email', async () => {
  const email = 'query-only@example.com';
  const owner = { ...person(email), id: 'query-owner' };
  await db.doc('person/query-owner').set(owner);
  for (const [id, value] of [['query-match-a', email], ['query-match-b', email],
    ['query-unrelated', 'unrelated@example.com'], ['query-legacy', ' Query-Only@Example.com ']]) {
    await db.doc(`attendee/${id}`).set({ ...attendee(value), id });
  }
  const readIds = [];
  const original = db.runTransaction.bind(db);
  db.runTransaction = (work, ...options) => original(async tx => {
    const getAll = tx.getAll.bind(tx);
    tx.getAll = (...refs) => {
      readIds.push(...refs.map(ref => ref.id));
      return getAll(...refs);
    };
    return work(tx);
  }, ...options);
  try { await linkPersonAttendees(owner); }
  finally { db.runTransaction = original; }
  assert.deepEqual(readIds.sort(), ['query-match-a', 'query-match-b']);
  assert.equal((await db.doc('attendee/query-match-a').get()).data().person.personId, owner.id);
  assert.equal((await db.doc('attendee/query-unrelated').get()).data().person.personId, undefined);
  assert.equal((await db.doc('attendee/query-legacy').get()).data().person.personId, undefined);
});

test('attendee creation after account creation resolves Person automatically and validates explicit links', async () => {
  const email = 'after-account@example.com';
  const owner = await createPersonHandler(context({ person: person(email) }, email));
  const saved = await saveAttendeeHandler(context({ attendee: attendee(email) }));
  assert.equal(saved.person.personId, owner.id);
  const reassigned = await saveAttendeeHandler(context({ attendee: { ...saved,
    person: { ...saved.person, email: 'new-unregistered@example.com' } } }));
  assert.equal(reassigned.person.personId, undefined);
  await assert.rejects(saveAttendeeHandler(context({ attendee: {
    ...attendee('wrong@example.com'), person: { ...attendee('wrong@example.com').person, personId: owner.id },
  } })), { code: 'invalid-argument' });
});

test('account deletion preserves complete attendees/indexes and re-registration replaces their old links', async () => {
  const email = 'delete-account@example.com';
  const auth = await admin.auth().createUser({ email, emailVerified: true });
  const owner = await createPersonHandler(context({ person: person(email, auth.uid) }, email, auth.uid));
  const saved = await saveAttendeeHandler(context({ attendee: attendee(email) }));
  const before = (await db.doc(`attendee/${saved.id}`).get()).data();
  await assert.rejects(deletePersonHandler(context({ personId: owner.id, deleteAccount: true })), { code: 'permission-denied' });
  await deletePersonHandler(context({ personId: owner.id, deleteAccount: true }, email, auth.uid));
  await assert.rejects(deletePersonHandler(context({ personId: owner.id, deleteAccount: true }, email, auth.uid)), { code: 'not-found' });
  assert.deepEqual((await db.doc(`attendee/${saved.id}`).get()).data(), before);
  assert.equal((await db.doc(`attendee-index/identity-t:${email}`).get()).data().attendeeId, saved.id);
  assert.equal((await db.doc(`person/${owner.id}`).get()).exists, false);
  await assert.rejects(linkPersonAttendees(owner), { code: 'failed-precondition' });
  const nextAuth = await admin.auth().createUser({ email, emailVerified: true });
  const next = await createPersonHandler(context({ person: person(email, nextAuth.uid) }, email, nextAuth.uid));
  assert.notEqual(owner.id, next.id);
  assert.equal((await db.doc(`attendee/${saved.id}`).get()).data().person.personId, next.id);
});

test('registration retries after a real failed linking commit without duplicating Person', async () => {
  const email = 'link-retry@example.com';
  await db.doc('attendee/link-retry').set({ ...attendee(email), id: 'link-retry' });
  const original = db.runTransaction.bind(db);
  let injected = false;
  db.runTransaction = (work, ...options) => original(async tx => {
    const update = tx.update.bind(tx);
    tx.update = (...args) => {
      if (!injected && args[0].path === 'attendee/link-retry') {
        injected = true;
        update(db.doc('missing-identity-tests/link-failure'), { fail: true });
      }
      return update(...args);
    };
    return work(tx);
  }, ...options);
  try { await assert.rejects(createPersonHandler(context({ person: person(email) }, email))); }
  finally { db.runTransaction = original; }
  assert.equal(injected, true);
  const lookup = (await db.doc(`email_personid/${email}`).get()).data();
  assert.ok(lookup.personId);
  const retry = await createPersonHandler(context({ person: person(email) }, email));
  assert.equal(retry.id, lookup.personId);
  assert.equal((await db.doc('attendee/link-retry').get()).data().person.personId, retry.id);
});

test('tournament bootstrap and cascade are server-authorized and retry after membership disappears', async () => {
  const email = 'bootstrap@example.com';
  await createPersonHandler(context({ person: person(email) }, email));
  const result = await createTournamentHandler(context({ tournament: { id: '', name: 'New', days: [] }, attendee: attendee(email) }, email));
  assert.deepEqual(result.attendee.roles, ['Referee', 'TournamentManager']);
  await db.doc('game/bootstrap-game').set({ tournamentId: result.tournament.id });
  await assert.rejects(deleteTournamentHandler(context({ tournamentId: result.tournament.id }, 'other@example.com')), { code: 'permission-denied' });
  await deleteTournamentHandler(context({ tournamentId: result.tournament.id }, email));
  assert.equal((await db.doc('game/bootstrap-game').get()).exists, false);
  assert.equal((await db.doc(`attendee/${result.attendee.id}`).get()).exists, false);
  await assert.rejects(deleteTournamentHandler(context({ tournamentId: result.tournament.id }, email)), { code: 'not-found' });
});

/** Encodes JSON into Firestore REST values for rule-enforced client requests. */
function restValue(value) {
  if (value === null) return { nullValue: null };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(restValue) } };
  if (typeof value === 'object') return { mapValue: { fields: restFields(value) } };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return { integerValue: String(value) };
  return { stringValue: value };
}
/** Encodes the fields in one document. */
function restFields(data) { return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, restValue(value)])); }
/** Creates an emulator-only identity token with independently controlled UID and verification. */
function token(email, uid, verified) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ iss: `https://securetoken.google.com/${project}`,
    aud: project, sub: uid, user_id: uid, email, email_verified: verified, iat: now, exp: now + 3600,
    auth_time: now, firebase: { sign_in_provider: 'password', identities: {} } })}.`;
}
/** Sends a real rule-enforced request; does not use Admin/owner bypass. */
async function client(path, data, email, uid = email, verified = true, method = 'PATCH') {
  const response = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${project}/databases/(default)/documents/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method, headers: { Authorization: `Bearer ${token(email, uid, verified)}`, 'Content-Type': 'application/json' },
    ...(data ? { body: JSON.stringify({ fields: restFields(data) }) } : {}),
  });
  const body = await response.text();
  return { status: response.status, body };
}

test('rules protect Person ownership/email and deny all direct attendee/index mutations', async () => {
  const profile = { ...person('rules-owner@example.com', 'rules-owner'), id: 'rules-owner' };
  await db.doc('person/rules-owner').set(profile);
  for (const [email, uid, allowed] of [['rules-owner@example.com', 'rules-owner', true],
    ['identity-admin@example.com', 'admin-uid', true], ['outsider@example.com', 'outsider', false],
    ['identity-manager@example.com', 'manager', false]]) {
    const saved = await client('person/rules-owner', { ...profile, firstName: 'Updated' }, email, uid);
    assert.equal(saved.status, allowed ? 200 : 403, saved.body);
    for (const patch of [{ email: 'stolen@example.com' }, { userAuthId: 'attacker' }]) {
      assert.equal((await client('person/rules-owner', { ...profile, ...patch }, email, uid)).status, 403);
    }
    assert.equal((await client('person/rules-owner', null, email, uid, true, 'DELETE')).status, 403);
  }
  const removedEmail = { ...profile }; delete removedEmail.email;
  assert.equal((await client('person/rules-owner', removedEmail, profile.email, 'rules-owner')).status, 403);
  assert.equal((await client('person/new-forged', { ...profile, id: 'new-forged' }, profile.email, 'rules-owner')).status, 403);
  assert.equal((await client('person/rules-owner', profile, profile.email, 'rules-owner', false)).status, 403);
  for (const path of ['attendee/direct', 'attendee-index/identity-t:direct@example.com']) {
    assert.equal((await client(path, { ...attendee('direct@example.com'), id: 'direct' }, 'identity-manager@example.com')).status, 403);
    await db.doc(path).set({ id: 'direct', tournamentId: 'identity-t' });
    assert.equal((await client(path, { id: 'direct' }, 'identity-admin@example.com')).status, 403);
    assert.equal((await client(path, null, 'identity-admin@example.com', undefined, true, 'DELETE')).status, 403);
  }
});

test('rules resolve current indexed roles, reject forged indexes, and revoke access immediately', async () => {
  const email = 'rule-coach@example.com';
  const ref = db.doc('attendee/rule-coach');
  await ref.set({ ...attendee(email), id: 'rule-coach', roles: ['TournamentManager'] });
  const index = db.doc(`attendee-index/identity-t:${email}`);
  await index.set({ attendeeId: 'rule-coach' });
  const game = { id: 'rule-game', tournamentId: 'identity-t' };
  assert.equal((await client('game/rule-game', game, ' Rule-Coach@Example.com ')).status, 200);
  assert.equal((await client('game/legacy-game', game, 'legacy@example.com')).status, 403);
  assert.equal((await client('game/unverified-game', game, email, email, false)).status, 403);
  await ref.update({ roles: ['Referee'] });
  assert.equal((await client('game/rule-game', game, email)).status, 403);
  await ref.update({ roles: ['TournamentManager'], tournamentId: 'identity-other' });
  assert.equal((await client('game/rule-game', game, email)).status, 403);
  await ref.update({ tournamentId: 'identity-t', 'person.email': 'someone-else@example.com' });
  assert.equal((await client('game/rule-game', game, email)).status, 403);
  await index.delete();
  assert.equal((await client('game/rule-game', game, email)).status, 403);
  const specialEmail = 'coach/%:test@example.com';
  await db.doc('attendee/special-email').set({ ...attendee(specialEmail), roles: ['TournamentManager'] });
  await db.collection('attendee-index').doc(attendeeIndexId('identity-t', specialEmail)).set({ attendeeId: 'special-email' });
  const specialResult = await client('game/special-email-game', game, specialEmail);
  assert.equal(specialResult.status, 200, specialResult.body);
});
