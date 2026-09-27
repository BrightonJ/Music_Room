const db = require('../config/db');

const cut = (value, max) => (typeof value === 'string' && value.length ? value.slice(0, max) : null);

// Every action performed from the app is logged with platform, device and app
// version (subject V.6). A logging failure never breaks the request.
async function logActivity({ userId, action, platform, deviceName, appVersion, metadata }) {
  try {
    await db.query(
      `INSERT INTO activity_logs (user_id, action, platform, device_name, app_version, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId || null,
        cut(action, 150) || 'unknown',
        cut(platform, 20),
        cut(deviceName, 100),
        cut(appVersion, 20),
        metadata ? JSON.stringify(metadata) : null,
      ]
    );
  } catch (err) {
    console.error('Failed to log activity:', err.message);
  }
}

function clientInfoFromHeaders(headers) {
  return {
    platform: headers['x-platform'],
    deviceName: headers['x-device'],
    appVersion: headers['x-app-version'],
  };
}

module.exports = { logActivity, clientInfoFromHeaders };
