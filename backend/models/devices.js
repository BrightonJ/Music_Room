const db = require('../config/db');

async function registerDevice(userId, deviceUid, platform, deviceName) {
    const result = await db.query(
        `INSERT INTO devices (user_id, device_uid, platform, device_name, last_seen_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (user_id, device_uid) DO UPDATE SET last_seen_at = NOW(), platform = $3, device_name = $4
         RETURNING id`,
        [userId, deviceUid, platform || 'unknown', deviceName || 'Unknown device']
    );
    return result.rows[0].id;
}

module.exports = { registerDevice };