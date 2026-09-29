const express = require('express');
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { canAccessEvent, hasPlaybackControl, isAcceptedInvitee } = require('../models/events');
const { areFriends } = require('../models/profiles');
const { getIO, roomName, socketsInRoom, notifyUsers, notifyAll } = require('../sockets/ioState');
const { withRoomLock } = require('../sockets/roomLock');
const playback = require('../sockets/playback');
const { broadcastRoomMembers } = require('../sockets/presence');
const { ClientError } = require('../utils/errors');
const {
  parseId,
  cleanString,
  usernameRegex,
  VOTE_LICENSES,
  isFiniteNumberInRange,
  parseDateTime,
} = require('../utils/validators');

const router = express.Router();
const MAX_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function eventIdFrom(req) {
  const id = parseId(req.params.id);
  if (!id) throw new ClientError('Event not found', 404);
  return id;
}

async function requireOwnedEvent(eventId, userId, forbiddenMessage) {
  const result = await db.query('SELECT * FROM events WHERE id = $1', [eventId]);
  if (result.rows.length === 0) throw new ClientError('Event not found', 404);
  if (result.rows[0].owner_id !== userId) throw new ClientError(forbiddenMessage, 403);
  return result.rows[0];
}

function parseEventInput(body) {
  const name = cleanString(body.name, 100);
  if (!name) throw new ClientError('Event name must be 1 to 100 characters');
  if (body.isPrivate !== undefined && typeof body.isPrivate !== 'boolean') throw new ClientError('isPrivate must be a boolean');
  const voteLicense = body.voteLicense === undefined ? 'everyone' : body.voteLicense;
  if (!VOTE_LICENSES.includes(voteLicense)) throw new ClientError(`voteLicense must be one of: ${VOTE_LICENSES.join(', ')}`);

  // Public by default (subject V.2.1), whatever the client sends or omits
  const input = {
    name,
    isPrivate: body.isPrivate === true,
    voteLicense,
    lat: null,
    lng: null,
    radius: null,
    startsAt: null,
    endsAt: null,
  };

  if (voteLicense === 'location') {
    if (!isFiniteNumberInRange(body.locationLat, -90, 90) || !isFiniteNumberInRange(body.locationLng, -180, 180)) {
      throw new ClientError('A valid event location is required for the on-site license');
    }
    const radius = body.locationRadiusM === undefined ? 100 : body.locationRadiusM;
    if (!Number.isInteger(radius) || radius < 20 || radius > 5000) throw new ClientError('Radius must be between 20 and 5000 meters');
    const startsAt = parseDateTime(body.voteStartsAt);
    const endsAt = parseDateTime(body.voteEndsAt);
    if (!startsAt || !endsAt) throw new ClientError('Voting start and end are required for the on-site license');
    if (endsAt <= startsAt) throw new ClientError('The voting window must end after it starts');
    if (endsAt.getTime() <= Date.now()) throw new ClientError('The voting window is already over');
    if (endsAt - startsAt > MAX_WINDOW_MS) throw new ClientError('The voting window cannot exceed 7 days');
    Object.assign(input, { lat: body.locationLat, lng: body.locationLng, radius, startsAt, endsAt });
  }
  return input;
}

router.post('/events', requireAuth, async (req, res) => {
  const input = parseEventInput(req.body || {});
  const result = await db.query(
    `INSERT INTO events (owner_id, name, is_private, vote_license, location_lat, location_lng, location_radius_m, vote_starts_at, vote_ends_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [req.user.userId, input.name, input.isPrivate, input.voteLicense, input.lat, input.lng, input.radius, input.startsAt, input.endsAt]
  );
  const event = result.rows[0];
  // Rooms lists refresh live: everyone for a public room, only the host's other devices for a private one
  const change = { reason: 'created', eventId: event.id };
  if (event.is_private) notifyUsers([req.user.userId], 'events_changed', change);
  else notifyAll('events_changed', change);
  res.status(201).json({ message: 'Room created', event });
});

router.get('/events', requireAuth, async (req, res) => {
  const result = await db.query(
    `SELECT e.id, e.name, e.is_private, e.vote_license, e.vote_starts_at, e.vote_ends_at, e.created_at,
            e.owner_id, u.username AS owner_username, (e.owner_id = $1) AS is_owner
     FROM events e JOIN users u ON u.id = e.owner_id
     WHERE e.is_private = false OR e.owner_id = $1 OR EXISTS (
       SELECT 1 FROM event_invitations ei WHERE ei.event_id = e.id AND ei.user_id = $1 AND ei.status = 'accepted')
     ORDER BY (e.owner_id = $1) DESC, e.created_at DESC
     LIMIT 100`,
    [req.user.userId]
  );
  res.json(result.rows);
});

router.get('/events/:id', requireAuth, async (req, res) => {
  const eventId = eventIdFrom(req);
  const event = await canAccessEvent(req.user.userId, eventId);
  if (!event) throw new ClientError('Event not found', 404);
  const [owner, hasControl, isInvited] = await Promise.all([
    db.query('SELECT username FROM users WHERE id = $1', [event.owner_id]),
    // Same rule as the socket: the delegation must match THIS device
    hasPlaybackControl(req.user.userId, eventId, req.user.deviceRowId),
    isAcceptedInvitee(req.user.userId, eventId),
  ]);
  res.json({
    ...event,
    owner_username: owner.rows[0] ? owner.rows[0].username : null,
    isOwner: event.owner_id === req.user.userId,
    hasControl,
    isInvited,
  });
});

// The host leaves with the "Leave" button; deleting is a separate, explicit action
router.delete('/events/:id', requireAuth, async (req, res) => {
  const eventId = eventIdFrom(req);
  await requireOwnedEvent(eventId, req.user.userId, 'Only the host can delete this room');
  // Read before the cascade deletes them: who must see the room disappear from their lists
  const before = await db.query('SELECT is_private FROM events WHERE id = $1', [eventId]);
  const invitees = await db.query('SELECT user_id FROM event_invitations WHERE event_id = $1', [eventId]);
  await withRoomLock(eventId, async () => {
    playback.stopPlayback(eventId);
    await db.query('DELETE FROM events WHERE id = $1', [eventId]);
  });
  const io = getIO();
  if (io) {
    io.to(roomName(eventId)).emit('room_closed', { eventId });
    io.in(roomName(eventId)).socketsLeave(roomName(eventId));
  }
  const change = { reason: 'deleted', eventId };
  if (before.rows[0] && !before.rows[0].is_private) notifyAll('events_changed', change);
  else notifyUsers([req.user.userId, ...invitees.rows.map((r) => r.user_id)], 'events_changed', change);
  res.json({ message: 'Room deleted' });
});

router.post('/events/:id/invite', requireAuth, async (req, res) => {
  const eventId = eventIdFrom(req);
  await requireOwnedEvent(eventId, req.user.userId, 'Only the host can invite people');
  const username = req.body && req.body.username;
  if (typeof username !== 'string' || !usernameRegex.test(username)) throw new ClientError('Username required');
  const target = await db.query('SELECT id FROM users WHERE username = $1', [username]);
  if (target.rows.length === 0) throw new ClientError('User not found', 404);
  const targetId = target.rows[0].id;
  if (targetId === req.user.userId) throw new ClientError('You are the host of this room');
  if (!(await areFriends(req.user.userId, targetId))) throw new ClientError('You can only invite friends', 403);

  const inserted = await db.query(
    `INSERT INTO event_invitations (event_id, user_id, invited_by, status) VALUES ($1, $2, $3, 'pending')
     ON CONFLICT (event_id, user_id) DO UPDATE SET invited_by = EXCLUDED.invited_by
     WHERE event_invitations.status <> 'accepted'
     RETURNING status`,
    [eventId, targetId, req.user.userId]
  );
  // No row returned: the friend had already accepted, nothing to notify
  if (inserted.rows.length > 0) {
    const info = await db.query(
      'SELECT e.name, u.username FROM events e JOIN users u ON u.id = $2 WHERE e.id = $1',
      [eventId, req.user.userId]
    );
    const { name, username: host } = info.rows[0];
    notifyUsers([targetId, req.user.userId], 'invitations_changed', { reason: 'invited', eventId, eventName: name, username: host, userId: targetId });
  }
  res.status(201).json({ message: 'Invitation sent' });
});

// Invitation status of each friend for this room (host only): the invite screen
// shows who is invited, who joined, and lets the host invite again after a decline
router.get('/events/:id/invitations', requireAuth, async (req, res) => {
  const eventId = eventIdFrom(req);
  await requireOwnedEvent(eventId, req.user.userId, 'Only the host can see the invitations');
  const result = await db.query(
    `SELECT ei.user_id, u.username, ei.status FROM event_invitations ei JOIN users u ON u.id = ei.user_id
     WHERE ei.event_id = $1 ORDER BY u.username`,
    [eventId]
  );
  res.json(result.rows);
});

// ---------- Music Control Delegation ----------

router.get('/events/:id/delegations', requireAuth, async (req, res) => {
  const eventId = eventIdFrom(req);
  if (!(await canAccessEvent(req.user.userId, eventId))) throw new ClientError('Event not found', 404);
  const result = await db.query(
    `SELECT ed.device_id, d.device_name, d.platform, u.id AS user_id, u.username, ed.created_at
     FROM event_delegations ed
     JOIN devices d ON d.id = ed.device_id
     JOIN users u ON u.id = ed.user_id
     WHERE ed.event_id = $1
     ORDER BY u.username, d.device_name`,
    [eventId]
  );
  res.json(result.rows);
});

// Every device of every friend of the host, with its current status in the room
router.get('/events/:id/delegation-candidates', requireAuth, async (req, res) => {
  const eventId = eventIdFrom(req);
  await requireOwnedEvent(eventId, req.user.userId, 'Only the host can manage control');
  const result = await db.query(
    `SELECT d.id AS device_id, d.device_name, d.platform, d.last_seen_at, u.id AS user_id, u.username,
            (ed.id IS NOT NULL) AS has_control
     FROM friendships f
     JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
     JOIN devices d ON d.user_id = u.id
     LEFT JOIN event_delegations ed ON ed.event_id = $2 AND ed.device_id = d.id
     WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = 'accepted'
     ORDER BY u.username, d.last_seen_at DESC`,
    [req.user.userId, eventId]
  );
  const inRoom = new Set((await socketsInRoom(eventId)).map((s) => s.data && s.data.deviceRowId));
  res.json(result.rows.map((row) => ({ ...row, in_room: inRoom.has(row.device_id) })));
});

router.post('/events/:id/delegations', requireAuth, async (req, res) => {
  const eventId = eventIdFrom(req);
  await requireOwnedEvent(eventId, req.user.userId, 'Only the host can grant control');
  const deviceId = parseId(req.body && req.body.deviceId);
  if (!deviceId) throw new ClientError('deviceId required');

  const device = await db.query('SELECT id, user_id FROM devices WHERE id = $1', [deviceId]);
  if (device.rows.length === 0) throw new ClientError('Device not found', 404);
  const delegateId = device.rows[0].user_id;
  if (delegateId === req.user.userId) throw new ClientError('You already control this room from all your devices');
  if (!(await areFriends(req.user.userId, delegateId))) throw new ClientError('You can only delegate control to friends', 403);
  if (!(await canAccessEvent(delegateId, eventId))) throw new ClientError('Invite this friend to the room first', 403);

  await db.query(
    `INSERT INTO event_delegations (event_id, user_id, device_id, granted_by) VALUES ($1, $2, $3, $4)
     ON CONFLICT (event_id, device_id) DO NOTHING`,
    [eventId, delegateId, deviceId, req.user.userId]
  );
  await broadcastRoomMembers(eventId);
  res.status(201).json({ message: 'Control granted to this device' });
});

// The host can revoke any delegation; a delegate can give back his own
router.delete('/events/:id/delegations/:deviceId', requireAuth, async (req, res) => {
  const eventId = eventIdFrom(req);
  const deviceId = parseId(req.params.deviceId);
  if (!deviceId) throw new ClientError('Delegation not found', 404);
  const event = await db.query('SELECT owner_id FROM events WHERE id = $1', [eventId]);
  if (event.rows.length === 0) throw new ClientError('Event not found', 404);
  const isOwner = event.rows[0].owner_id === req.user.userId;

  const result = await db.query(
    `DELETE FROM event_delegations WHERE event_id = $1 AND device_id = $2 AND ($3::boolean OR user_id = $4) RETURNING id`,
    [eventId, deviceId, isOwner, req.user.userId]
  );
  if (result.rows.length === 0) throw new ClientError('Delegation not found', 404);
  await broadcastRoomMembers(eventId);
  res.json({ message: 'Control revoked' });
});

module.exports = router;
