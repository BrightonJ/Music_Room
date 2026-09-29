// End-to-end tests of the REST API and the Socket.IO protocol against a real
// PostgreSQL database. The database pointed by TEST_DATABASE_URL is WIPED.
//   TEST_DATABASE_URL=postgres://user:pass@localhost:5432/musicroom_test npm run test:integration
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const TEST_DB = process.env.TEST_DATABASE_URL;

if (!TEST_DB) {
  test('integration tests (skipped: set TEST_DATABASE_URL)', { skip: true }, () => {});
} else {
  // Must be set BEFORE the application modules are loaded
  process.env.DATABASE_URL = TEST_DB;
  process.env.JWT_SECRET = 'integration-tests-secret-with-more-than-32-characters';
  process.env.RATE_LIMIT_DISABLED = '1';
  process.env.NODE_ENV = 'test';
  process.env.SMTP_HOST = ''; // never send real emails from the tests

  const bcrypt = require('bcrypt');
  const { io: ioClient } = require('socket.io-client');
  const pool = require('../../config/db');
  const { resetSchema } = require('../../db/schema');
  const deezer = require('../../services/deezer');
  const { start } = require('../../bootstrap');

  // Deezer is replaced by a deterministic fake catalog
  deezer.getTrack = async (id) => ({
    deezerId: Number(id),
    title: `Track ${id}`,
    artist: 'Test artist',
    coverUrl: null,
    previewUrl: `https://cdn.test.invalid/${id}.mp3?fresh=${Date.now()}`,
    durationMs: 30000,
  });
  deezer.searchTracks = async () => [];

  const PASSWORD = 'Passw0rd!';
  let base;
  let serverHandle;
  let passwordHash;
  let counter = 0;
  const sockets = [];

  async function createUser() {
    counter += 1;
    const username = `user${counter}`;
    const email = `${username}@test.local`;
    const r = await pool.query(
      `INSERT INTO users (email, username, password, first_name, last_name, birth_date, is_verified)
       VALUES ($1, $2, $3, 'First', 'Last', '2000-01-15', true) RETURNING id`,
      [email, username, passwordHash]
    );
    return { id: r.rows[0].id, username, email };
  }

  async function api(path, { method = 'GET', token, body, deviceUid } = {}) {
    const headers = { 'Content-Type': 'application/json', 'X-Platform': 'test', 'X-Device': 'node test', 'X-App-Version': 'test' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (deviceUid) headers['X-Device-Id'] = deviceUid;
    const res = await fetch(`${base}/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status: res.status, data };
  }

  async function login(user) {
    const deviceUid = crypto.randomUUID();
    const r = await api('/login', { method: 'POST', body: { email: user.email, password: PASSWORD }, deviceUid });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    return { token: r.data.token, deviceId: r.data.deviceId };
  }

  const makeFriends = (a, b) =>
    pool.query(`INSERT INTO friendships (requester_id, addressee_id, status) VALUES ($1, $2, 'accepted')`, [a.id, b.id]);

  function connect(token) {
    return new Promise((resolve, reject) => {
      const socket = ioClient(base, { transports: ['websocket'], auth: { token }, forceNew: true, reconnection: false });
      sockets.push(socket);
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', reject);
    });
  }

  const emit = (socket, event, payload) => socket.timeout(5000).emitWithAck(event, payload);

  async function createEvent(token, body) {
    const r = await api('/events', { method: 'POST', token, body });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    return r.data.event;
  }

  async function joinedSocket(session, eventId) {
    const socket = await connect(session.token);
    const ack = await emit(socket, 'join_room', { roomId: eventId });
    assert.equal(ack.ok, true, JSON.stringify(ack));
    return socket;
  }

  const queuedTrackId = async (eventId, deezerId) =>
    (await pool.query(`SELECT id FROM tracks WHERE event_id = $1 AND deezer_id = $2 AND status = 'queued'`, [eventId, deezerId])).rows[0].id;

  before(async () => {
    await resetSchema(pool);
    passwordHash = await bcrypt.hash(PASSWORD, 4);
    serverHandle = await start({ port: 0, host: '127.0.0.1', restore: false });
    base = `http://127.0.0.1:${serverHandle.port}`;
  });

  after(async () => {
    sockets.forEach((s) => s.disconnect());
    await new Promise((r) => setTimeout(r, 200));
    await serverHandle.close();
    await pool.end();
  });

  describe('accounts and sessions', () => {
    test('registration validates the input and does not allow login before activation', async () => {
      const weak = await api('/register', { method: 'POST', body: { email: 'new@test.local', password: 'weak', username: 'newbie', firstName: 'N', lastName: 'B' } });
      assert.equal(weak.status, 400);
      const ok = await api('/register', { method: 'POST', body: { email: 'New@Test.local', password: PASSWORD, username: 'newbie', firstName: 'N', lastName: 'B', birthDate: '1999-12-31' } });
      assert.equal(ok.status, 201);
      const dup = await api('/register', { method: 'POST', body: { email: 'new@test.local', password: PASSWORD, username: 'other', firstName: 'N', lastName: 'B' } });
      assert.equal(dup.status, 409);

      const row = (await pool.query(`SELECT is_verified, verification_token_hash FROM users WHERE email = 'new@test.local'`)).rows[0];
      assert.equal(row.is_verified, false);
      assert.match(row.verification_token_hash, /^[a-f0-9]{64}$/);

      const r = await api('/login', { method: 'POST', body: { email: 'new@test.local', password: PASSWORD }, deviceUid: crypto.randomUUID() });
      assert.equal(r.status, 403);
      assert.equal(r.data.code, 'EMAIL_NOT_VERIFIED');
      const badLink = await fetch(`${base}/api/verify/${'0'.repeat(64)}`);
      assert.equal(badLink.status, 400);
    });

    test('login errors: wrong password, unknown email, missing device id', async () => {
      const user = await createUser();
      const wrong = await api('/login', { method: 'POST', body: { email: user.email, password: 'Wrong-Passw0rd' }, deviceUid: crypto.randomUUID() });
      assert.equal(wrong.status, 401);
      const unknown = await api('/login', { method: 'POST', body: { email: 'nobody@test.local', password: PASSWORD }, deviceUid: crypto.randomUUID() });
      assert.equal(unknown.status, 401);
      assert.equal(unknown.data.error, wrong.data.error);
      const noDevice = await api('/login', { method: 'POST', body: { email: user.email, password: PASSWORD } });
      assert.equal(noDevice.status, 400);
    });

    test('login with the email or the username, case-insensitive; usernames are unique regardless of case', async () => {
      const user = await createUser();
      const byEmail = await api('/login', { method: 'POST', body: { identifier: user.email.toUpperCase(), password: PASSWORD }, deviceUid: crypto.randomUUID() });
      assert.equal(byEmail.status, 200);
      const byUsername = await api('/login', { method: 'POST', body: { identifier: user.username.toUpperCase(), password: PASSWORD }, deviceUid: crypto.randomUUID() });
      assert.equal(byUsername.status, 200);
      assert.equal(byUsername.data.user.id, user.id);

      const wrong = await api('/login', { method: 'POST', body: { identifier: user.username, password: 'Wrong-Passw0rd' }, deviceUid: crypto.randomUUID() });
      const unknown = await api('/login', { method: 'POST', body: { identifier: 'nobody_here', password: PASSWORD }, deviceUid: crypto.randomUUID() });
      assert.equal(wrong.status, 401);
      assert.equal(unknown.status, 401);
      assert.equal(unknown.data.error, wrong.data.error);

      const clash = await api('/register', {
        method: 'POST',
        body: { email: 'clash@test.local', password: PASSWORD, username: user.username.toUpperCase(), firstName: 'C', lastName: 'L', birthDate: '1999-12-31' },
      });
      assert.equal(clash.status, 409);
    });

    test('birth date comes back exactly as stored (no time zone shift)', async () => {
      const user = await createUser();
      const { token } = await login(user);
      const r = await api('/profile', { token });
      assert.equal(r.status, 200);
      assert.equal(r.data.birth_date, '2000-01-15');
      const upd = await api('/profile', { method: 'PUT', token, body: { birthDate: '1995-03-01' } });
      assert.equal(upd.data.birth_date, '1995-03-01');
      assert.equal(upd.data.first_name, 'First'); // partial update keeps the other fields
    });

    test('profile privacy depends on friendship', async () => {
      const [owner, friend, stranger] = [await createUser(), await createUser(), await createUser()];
      await makeFriends(owner, friend);
      const ownerSession = await login(owner);
      await api('/profile', { method: 'PUT', token: ownerSession.token, body: { privacySettings: { last_name: 'friends', first_name: 'private' } } });
      const asFriend = await api(`/users/${owner.username}/profile`, { token: (await login(friend)).token });
      const asStranger = await api(`/users/${owner.username}/profile`, { token: (await login(stranger)).token });
      assert.equal(asFriend.data.last_name, 'Last');
      assert.equal(asFriend.data.first_name, undefined);
      assert.equal(asStranger.data.last_name, undefined);
    });

    test('friend requests and acceptances are pushed in real time to both users', async () => {
      const [alice, bob] = [await createUser(), await createUser()];
      const aliceSession = await login(alice);
      const bobSession = await login(bob);
      // No room joined: the personal channel works anywhere in the app
      const aliceSocket = await connect(aliceSession.token);
      const bobSocket = await connect(bobSession.token);
      const next = (socket) => new Promise((resolve) => socket.once('friends_changed', resolve));

      const bobNotified = next(bobSocket);
      const sent = await api('/friends/requests', { method: 'POST', token: aliceSession.token, body: { username: bob.username } });
      assert.equal(sent.status, 201);
      assert.deepEqual(await bobNotified, { reason: 'request', userId: alice.id, username: alice.username });

      const aliceNotified = next(aliceSocket);
      const accepted = await api(`/friends/requests/${sent.data.id}/accept`, { method: 'POST', token: bobSession.token });
      assert.equal(accepted.status, 200);
      assert.deepEqual(await aliceNotified, { reason: 'accepted', userId: bob.id, username: bob.username });
    });

    test('a declined invitation can be sent again; host and guest are notified live', async () => {
      const [host, guest] = [await createUser(), await createUser()];
      await makeFriends(host, guest);
      const hostSession = await login(host);
      const guestSession = await login(guest);
      const hostSocket = await connect(hostSession.token);
      const guestSocket = await connect(guestSession.token);
      const next = (socket, name) => new Promise((resolve) => socket.once(name, resolve));
      const ev = await createEvent(hostSession.token, { name: 'Invite again', isPrivate: true, voteLicense: 'everyone' });

      const invitedLive = next(guestSocket, 'invitations_changed');
      assert.equal((await api(`/events/${ev.id}/invite`, { method: 'POST', token: hostSession.token, body: { username: guest.username } })).status, 201);
      assert.equal((await invitedLive).reason, 'invited');
      const statuses = await api(`/events/${ev.id}/invitations`, { token: hostSession.token });
      assert.deepEqual(statuses.data.map((i) => [i.username, i.status]), [[guest.username, 'pending']]);

      const invitation = (await api('/invitations', { token: guestSession.token })).data[0];
      const declinedLive = next(hostSocket, 'invitations_changed');
      assert.equal((await api(`/invitations/${invitation.id}/decline`, { method: 'POST', token: guestSession.token })).status, 200);
      const declined = await declinedLive;
      assert.equal(declined.reason, 'declined');
      assert.equal(declined.username, guest.username);
      assert.equal((await api(`/events/${ev.id}/invitations`, { token: hostSession.token })).data.length, 0);

      // Invite again after the decline
      assert.equal((await api(`/events/${ev.id}/invite`, { method: 'POST', token: hostSession.token, body: { username: guest.username } })).status, 201);
      assert.equal((await api('/invitations', { token: guestSession.token })).data.length, 1);
      assert.equal((await api(`/events/${ev.id}/invitations`, { token: guestSession.token })).status, 403);
    });

    test('rooms lists refresh live: public rooms for everyone, private rooms for their guests only', async () => {
      const [host, other] = [await createUser(), await createUser()];
      const hostSession = await login(host);
      const otherSocket = await connect((await login(other)).token);
      const received = [];
      otherSocket.on('events_changed', (e) => received.push(e));

      const pub = await createEvent(hostSession.token, { name: 'Public party', isPrivate: false, voteLicense: 'everyone' });
      await createEvent(hostSession.token, { name: 'Private party', isPrivate: true, voteLicense: 'everyone' });
      assert.equal((await api(`/events/${pub.id}`, { method: 'DELETE', token: hostSession.token })).status, 200);
      await new Promise((r) => setTimeout(r, 150));
      assert.deepEqual(received, [
        { reason: 'created', eventId: pub.id },
        { reason: 'deleted', eventId: pub.id },
      ]);
    });

    test('removing a device and logging out revoke the token', async () => {
      const user = await createUser();
      const phoneA = await login(user);
      const phoneB = await login(user);
      assert.equal((await api('/profile', { token: phoneB.token })).status, 200);

      const removed = await api(`/devices/${phoneB.deviceId}`, { method: 'DELETE', token: phoneA.token });
      assert.equal(removed.status, 200);
      assert.equal((await api('/profile', { token: phoneB.token })).status, 401);
      await assert.rejects(connect(phoneB.token), /revoked/);

      assert.equal((await api('/logout', { method: 'POST', token: phoneA.token })).status, 200);
      assert.equal((await api('/profile', { token: phoneA.token })).status, 401);
    });

    test('a user cannot remove the device of someone else', async () => {
      const [a, b] = [await createUser(), await createUser()];
      const sa = await login(a);
      const sb = await login(b);
      assert.equal((await api(`/devices/${sb.deviceId}`, { method: 'DELETE', token: sa.token })).status, 404);
    });
  });

  describe('rooms and votes', () => {
    test('private rooms are invisible to strangers', async () => {
      const [owner, stranger] = [await createUser(), await createUser()];
      const so = await login(owner);
      const ss = await login(stranger);
      const ev = await createEvent(so.token, { name: 'Secret', isPrivate: true });
      assert.equal((await api(`/events/${ev.id}`, { token: ss.token })).status, 404);
      const socket = await connect(ss.token);
      const ack = await emit(socket, 'join_room', { roomId: ev.id });
      assert.equal(ack.ok, false);
    });

    test('a vote cannot target a track of another room (IDOR)', async () => {
      const [owner, attacker] = [await createUser(), await createUser()];
      const so = await login(owner);
      const sa = await login(attacker);
      const privateRoom = await createEvent(so.token, { name: 'Private', isPrivate: true });
      const publicRoom = await createEvent(so.token, { name: 'Public' });

      const ownerSocket = await joinedSocket(so, privateRoom.id);
      assert.equal((await emit(ownerSocket, 'add_track', { roomId: privateRoom.id, deezerId: 1001 })).ok, true);
      assert.equal((await emit(ownerSocket, 'add_track', { roomId: privateRoom.id, deezerId: 1002 })).ok, true);
      const target = await queuedTrackId(privateRoom.id, 1002);

      const attackerSocket = await joinedSocket(sa, publicRoom.id);
      const ack = await emit(attackerSocket, 'vote_track', { roomId: publicRoom.id, trackId: target, value: 1 });
      assert.equal(ack.ok, false);
      const votes = await pool.query('SELECT COUNT(*)::int AS n FROM track_votes WHERE track_id = $1', [target]);
      assert.equal(votes.rows[0].n, 0);
    });

    test('concurrent votes are all counted, concurrent duplicate additions keep one track', async () => {
      const owner = await createUser();
      const so = await login(owner);
      const ev = await createEvent(so.token, { name: 'Busy party' });
      const ownerSocket = await joinedSocket(so, ev.id);
      await emit(ownerSocket, 'add_track', { roomId: ev.id, deezerId: 2001 }); // starts playing
      await emit(ownerSocket, 'add_track', { roomId: ev.id, deezerId: 2002 }); // queued
      const trackId = await queuedTrackId(ev.id, 2002);

      const guests = [];
      for (let i = 0; i < 12; i++) guests.push(await joinedSocket(await login(await createUser()), ev.id));

      const acks = await Promise.all(guests.map((s) => emit(s, 'vote_track', { roomId: ev.id, trackId, value: 1 })));
      assert.ok(acks.every((a) => a.ok), JSON.stringify(acks));
      const score = await pool.query('SELECT SUM(value)::int AS s FROM track_votes WHERE track_id = $1', [trackId]);
      assert.equal(score.rows[0].s, 12);

      const adds = await Promise.all(guests.slice(0, 6).map((s) => emit(s, 'add_track', { roomId: ev.id, deezerId: 3003 })));
      assert.equal(adds.filter((a) => a.ok).length, 1);
      const rows = await pool.query(`SELECT COUNT(*)::int AS n FROM tracks WHERE event_id = $1 AND deezer_id = 3003`, [ev.id]);
      assert.equal(rows.rows[0].n, 1);

      // The broadcast queue reflects the 12 votes
      const listener = await connect(so.token);
      const queue = new Promise((resolve) => listener.once('queue_update', resolve));
      await emit(listener, 'join_room', { roomId: ev.id });
      const { tracks } = await queue;
      assert.equal(tracks[0].id, trackId);
      assert.equal(tracks[0].votes, 12);
      assert.ok(!tracks.some((t) => t.deezerId === 2001), 'the playing track is not in the queue');
    });

    test('"invited" license: only the host and invited guests can vote', async () => {
      const [owner, friend, stranger] = [await createUser(), await createUser(), await createUser()];
      await makeFriends(owner, friend);
      const so = await login(owner);
      const sf = await login(friend);
      const ss = await login(stranger);
      const ev = await createEvent(so.token, { name: 'Guests only', voteLicense: 'invited' });

      const ownerSocket = await joinedSocket(so, ev.id);
      await emit(ownerSocket, 'add_track', { roomId: ev.id, deezerId: 4001 });
      await emit(ownerSocket, 'add_track', { roomId: ev.id, deezerId: 4002 });
      const trackId = await queuedTrackId(ev.id, 4002);

      const strangerSocket = await joinedSocket(ss, ev.id);
      const refused = await emit(strangerSocket, 'vote_track', { roomId: ev.id, trackId, value: 1 });
      assert.equal(refused.ok, false);

      assert.equal((await api(`/events/${ev.id}/invite`, { method: 'POST', token: so.token, body: { username: stranger.username } })).status, 403);
      assert.equal((await api(`/events/${ev.id}/invite`, { method: 'POST', token: so.token, body: { username: friend.username } })).status, 201);
      const invitations = await api('/invitations', { token: sf.token });
      await api(`/invitations/${invitations.data[0].id}/accept`, { method: 'POST', token: sf.token });

      const friendSocket = await joinedSocket(sf, ev.id);
      assert.equal((await emit(friendSocket, 'vote_track', { roomId: ev.id, trackId, value: 1 })).ok, true);
      assert.equal((await emit(ownerSocket, 'vote_track', { roomId: ev.id, trackId, value: -1 })).ok, true);
    });

    test('"location" license: position and time window are checked', async () => {
      const [owner, guest] = [await createUser(), await createUser()];
      const so = await login(owner);
      const sg = await login(guest);
      const now = Date.now();
      const ev = await createEvent(so.token, {
        name: 'On site',
        voteLicense: 'location',
        locationLat: 48.8966,
        locationLng: 2.3185,
        locationRadiusM: 200,
        voteStartsAt: new Date(now - 3600000).toISOString(),
        voteEndsAt: new Date(now + 3600000).toISOString(),
      });
      const ownerSocket = await joinedSocket(so, ev.id);
      await emit(ownerSocket, 'add_track', { roomId: ev.id, deezerId: 5001 });
      await emit(ownerSocket, 'add_track', { roomId: ev.id, deezerId: 5002 });
      const trackId = await queuedTrackId(ev.id, 5002);

      const guestSocket = await joinedSocket(sg, ev.id);
      assert.equal((await emit(guestSocket, 'vote_track', { roomId: ev.id, trackId, value: 1 })).ok, false);
      assert.equal((await emit(guestSocket, 'vote_track', { roomId: ev.id, trackId, value: 1, lat: 48.8566, lng: 2.3522 })).ok, false);
      assert.equal((await emit(guestSocket, 'vote_track', { roomId: ev.id, trackId, value: 1, lat: 48.8968, lng: 2.3187 })).ok, true);

      const invalid = await api('/events', { method: 'POST', token: so.token, body: { name: 'Bad', voteLicense: 'location', locationLat: 48.9, locationLng: 2.3 } });
      assert.equal(invalid.status, 400);
    });
  });

  describe('playback and delegation', () => {
    test('control is delegated to ONE device of a friend', async () => {
      const [owner, friend, stranger] = [await createUser(), await createUser(), await createUser()];
      await makeFriends(owner, friend);
      const so = await login(owner);
      const friendPhone = await login(friend);
      const friendTablet = await login(friend);
      const ss = await login(stranger);
      const ev = await createEvent(so.token, { name: 'Delegation' });

      const ownerSocket = await joinedSocket(so, ev.id);
      await emit(ownerSocket, 'add_track', { roomId: ev.id, deezerId: 6001 });

      const candidates = await api(`/events/${ev.id}/delegation-candidates`, { token: so.token });
      assert.equal(candidates.status, 200);
      assert.equal(candidates.data.filter((c) => c.user_id === friend.id).length, 2);
      const strangerDevice = (await pool.query('SELECT id FROM devices WHERE user_id = $1', [stranger.id])).rows[0].id;
      assert.equal((await api(`/events/${ev.id}/delegations`, { method: 'POST', token: so.token, body: { deviceId: strangerDevice } })).status, 403);
      assert.equal((await api(`/events/${ev.id}/delegations`, { method: 'POST', token: ss.token, body: { deviceId: friendPhone.deviceId } })).status, 403);

      assert.equal((await api(`/events/${ev.id}/delegations`, { method: 'POST', token: so.token, body: { deviceId: friendPhone.deviceId } })).status, 201);
      assert.equal((await api(`/events/${ev.id}`, { token: friendPhone.token })).data.hasControl, true);
      assert.equal((await api(`/events/${ev.id}`, { token: friendTablet.token })).data.hasControl, false);

      const tabletSocket = await joinedSocket(friendTablet, ev.id);
      assert.equal((await emit(tabletSocket, 'control_playback', { roomId: ev.id, action: 'pause' })).ok, false);

      const phoneSocket = await joinedSocket(friendPhone, ev.id);
      assert.equal((await emit(phoneSocket, 'control_playback', { roomId: ev.id, action: 'pause' })).ok, true);
      let state = (await pool.query('SELECT is_playing, position_ms FROM event_playback WHERE event_id = $1', [ev.id])).rows[0];
      assert.equal(state.is_playing, false);

      assert.equal((await emit(phoneSocket, 'control_playback', { roomId: ev.id, action: 'play' })).ok, true);
      state = (await pool.query('SELECT is_playing FROM event_playback WHERE event_id = $1', [ev.id])).rows[0];
      assert.equal(state.is_playing, true);

      // The delegate gives control back
      assert.equal((await api(`/events/${ev.id}/delegations/${friendPhone.deviceId}`, { method: 'DELETE', token: friendPhone.token })).status, 200);
      assert.equal((await emit(phoneSocket, 'control_playback', { roomId: ev.id, action: 'pause' })).ok, false);
    });

    test('next skips to the most voted track and the room keeps living when the host leaves', async () => {
      const [owner, guest] = [await createUser(), await createUser()];
      const so = await login(owner);
      const sg = await login(guest);
      const ev = await createEvent(so.token, { name: 'Skip' });
      const ownerSocket = await joinedSocket(so, ev.id);
      await emit(ownerSocket, 'add_track', { roomId: ev.id, deezerId: 7001 });
      await emit(ownerSocket, 'add_track', { roomId: ev.id, deezerId: 7002 });
      await emit(ownerSocket, 'add_track', { roomId: ev.id, deezerId: 7003 });
      const favourite = await queuedTrackId(ev.id, 7003);
      const guestSocket = await joinedSocket(sg, ev.id);
      await emit(guestSocket, 'vote_track', { roomId: ev.id, trackId: favourite, value: 1 });

      assert.equal((await emit(guestSocket, 'control_playback', { roomId: ev.id, action: 'next' })).ok, false);
      const playback = new Promise((resolve) => guestSocket.once('playback_update', resolve));
      assert.equal((await emit(ownerSocket, 'control_playback', { roomId: ev.id, action: 'next' })).ok, true);
      const update = await playback;
      assert.equal(update.nowPlaying.track.id, favourite);
      assert.ok(update.nowPlaying.track.previewUrl.startsWith('https://'));
      assert.ok(update.nowPlaying.durationMs <= 30000);

      await emit(ownerSocket, 'leave_room', {});
      assert.equal((await api(`/events/${ev.id}`, { token: sg.token })).status, 200);

      assert.equal((await api(`/events/${ev.id}`, { method: 'DELETE', token: sg.token })).status, 403);
      const closed = new Promise((resolve) => guestSocket.once('room_closed', resolve));
      assert.equal((await api(`/events/${ev.id}`, { method: 'DELETE', token: so.token })).status, 200);
      assert.equal((await closed).eventId, ev.id);
    });
  });
}
