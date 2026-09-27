const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { deviceUidRegex } = require('../utils/validators');

const clean = (value, max, fallback) => {
  if (typeof value !== 'string') return fallback;
  const printable = value.replace(/[^\x20-\x7E]/g, '').trim();
  return printable ? printable.slice(0, max) : fallback;
};

// Device information sent by the app in the X-Device-Id / X-Platform / X-Device headers
function readDeviceInfo(headers) {
  const uid = headers['x-device-id'];
  if (typeof uid !== 'string' || !deviceUidRegex.test(uid)) return null;
  return {
    uid,
    platform: clean(headers['x-platform'], 20, 'unknown'),
    name: clean(headers['x-device'], 100, 'Unknown device'),
  };
}

// A session = a device row + a random session id copied into the JWT.
// Logging in again on the same device replaces the session id (old tokens die).
async function openSession(userId, device) {
  const sessionId = crypto.randomBytes(24).toString('hex');
  const result = await db.query(
    `INSERT INTO devices (user_id, device_uid, platform, device_name, session_id, last_seen_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (user_id, device_uid)
     DO UPDATE SET platform = EXCLUDED.platform, device_name = EXCLUDED.device_name,
                   session_id = EXCLUDED.session_id, last_seen_at = NOW()
     RETURNING id`,
    [userId, device.uid, device.platform, device.name, sessionId]
  );
  const deviceId = result.rows[0].id;
  const token = jwt.sign({ userId, deviceId, sid: sessionId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
  return { token, deviceId };
}

// Returns the session behind a token, or null if the token is invalid, expired,
// or if its device was logged out / removed. Database errors are NOT swallowed.
async function verifySession(token) {
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
  if (!payload || !Number.isInteger(payload.userId) || !Number.isInteger(payload.deviceId) || typeof payload.sid !== 'string') {
    return null;
  }
  const result = await db.query(
    'SELECT id, device_name, platform FROM devices WHERE id = $1 AND user_id = $2 AND session_id = $3',
    [payload.deviceId, payload.userId, payload.sid]
  );
  if (result.rows.length === 0) return null;
  return {
    userId: payload.userId,
    deviceId: payload.deviceId,
    deviceName: result.rows[0].device_name,
    platform: result.rows[0].platform,
  };
}

async function closeSession(deviceId) {
  await db.query('UPDATE devices SET session_id = NULL WHERE id = $1', [deviceId]);
}

async function closeAllSessions(userId) {
  await db.query('UPDATE devices SET session_id = NULL WHERE user_id = $1', [userId]);
}

module.exports = { readDeviceInfo, openSession, verifySession, closeSession, closeAllSessions };
