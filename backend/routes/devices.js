const express = require('express');
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { ClientError } = require('../utils/errors');
const { parseId } = require('../utils/validators');
const { disconnectDevice } = require('../sockets/ioState');
const { broadcastRoomMembers } = require('../sockets/presence');

const router = express.Router();

router.get('/devices', requireAuth, async (req, res) => {
  const result = await db.query(
    `SELECT id, platform, device_name, last_seen_at, created_at,
            (session_id IS NOT NULL) AS signed_in, (id = $2) AS is_current
     FROM devices WHERE user_id = $1 ORDER BY last_seen_at DESC`,
    [req.user.userId, req.user.deviceRowId]
  );
  res.json(result.rows);
});

// Removing a device revokes its session for real: its token is refused by the
// API and the sockets, and the controls delegated to it disappear (cascade).
router.delete('/devices/:id', requireAuth, async (req, res) => {
  const deviceId = parseId(req.params.id);
  if (!deviceId) throw new ClientError('Device not found', 404);
  const delegations = await db.query('SELECT DISTINCT event_id FROM event_delegations WHERE device_id = $1', [deviceId]);
  const result = await db.query('DELETE FROM devices WHERE id = $1 AND user_id = $2 RETURNING id', [deviceId, req.user.userId]);
  if (result.rows.length === 0) throw new ClientError('Device not found', 404);

  await disconnectDevice(deviceId);
  for (const { event_id: eventId } of delegations.rows) {
    broadcastRoomMembers(eventId).catch((err) => console.error(err));
  }
  res.json({ message: 'Device removed', wasCurrentDevice: deviceId === req.user.deviceRowId });
});

module.exports = router;
