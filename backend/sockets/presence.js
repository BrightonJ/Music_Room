const db = require('../config/db');
const { getIO, roomName } = require('./ioState');
const { withRoomLock } = require('./roomLock');

// One entry PER DEVICE connected to the room: control is delegated per device,
// so a user connected twice appears twice (with possibly different rights).
async function buildMembers(eventId) {
  const io = getIO();
  if (!io) return null;
  const sockets = await io.in(roomName(eventId)).fetchSockets();
  if (sockets.length === 0) return null;

  const event = await db.query('SELECT owner_id FROM events WHERE id = $1', [eventId]);
  if (event.rows.length === 0) return null;
  const ownerId = event.rows[0].owner_id;

  const byDevice = new Map();
  for (const s of sockets) {
    const d = s.data || {};
    if (d.deviceRowId && !byDevice.has(d.deviceRowId)) {
      byDevice.set(d.deviceRowId, { userId: d.userId, deviceId: d.deviceRowId, deviceName: d.deviceName, platform: d.platform });
    }
  }
  const userIds = [...new Set([...byDevice.values()].map((c) => c.userId))];
  const [users, delegations] = await Promise.all([
    db.query('SELECT id, username FROM users WHERE id = ANY($1::int[])', [userIds]),
    db.query('SELECT device_id FROM event_delegations WHERE event_id = $1', [eventId]),
  ]);
  const names = new Map(users.rows.map((u) => [u.id, u.username]));
  const delegated = new Set(delegations.rows.map((r) => r.device_id));

  return [...byDevice.values()]
    .filter((c) => names.has(c.userId))
    .map((c) => ({
      ...c,
      username: names.get(c.userId),
      isOwner: c.userId === ownerId,
      hasControl: c.userId === ownerId || delegated.has(c.deviceId),
    }))
    .sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || a.username.localeCompare(b.username));
}

// Must NOT be called from inside the lock of the same room
function broadcastRoomMembers(eventId) {
  return withRoomLock(eventId, async () => {
    const members = await buildMembers(eventId);
    if (!members) return;
    getIO().to(roomName(eventId)).emit('room_members', { eventId: Number(eventId), members });
  });
}

module.exports = { broadcastRoomMembers };
