const db = require('../config/db');

async function logActivity({ userId, action, platform, deviceName, appVersion, metadata }) {
    try {
        await db.query(
            `INSERT INTO activity_logs (user_id, action, platform, device_name, app_version, metadata)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [userId || null, action, platform || null, deviceName || null, appVersion || null, metadata ? JSON.stringify(metadata) : null]
        );
    } catch (err) {
        console.error('Failed to log activity:', err);
    }
}

module.exports = { logActivity };