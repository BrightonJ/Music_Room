const db = require('../config/db');

const cut = (value, max) => (typeof value === 'string' && value.length ? value.slice(0, max) : null);

// Also printed in the terminal running the server (LOG_TO_CONSOLE=0 to turn it off;
// always off under `node --test`). Tokens never appear: routes are logged by pattern.
const printToConsole = process.env.LOG_TO_CONSOLE !== '0' && !process.env.NODE_TEST_CONTEXT;

function printLine({ userId, action, platform, deviceName, appVersion, metadata }) {
  const time = new Date().toTimeString().slice(0, 8);
  const status = metadata && metadata.status;
  const failed = (status && status >= 400) || (metadata && metadata.ok === false);
  const details = [];
  if (status) details.push(String(status));
  if (metadata && metadata.durationMs !== undefined) details.push(`${metadata.durationMs}ms`);
  if (metadata) {
    for (const [key, value] of Object.entries(metadata)) {
      if (!['status', 'durationMs', 'ok'].includes(key)) details.push(`${key}=${typeof value === 'string' ? JSON.stringify(value) : value}`);
    }
  }
  const who = userId ? `user ${userId}` : 'guest';
  const client = [platform, deviceName && `"${deviceName}"`, appVersion && `v${appVersion}`].filter(Boolean).join(' ');
  console.log(`${time} ${failed ? '✖' : '•'} ${action}  ${details.join(' ')}  [${who}${client ? `, ${client}` : ''}]`);
}

// Every action performed from the app is logged with platform, device and app
// version (subject V.6). A logging failure never breaks the request.
async function logActivity({ userId, action, platform, deviceName, appVersion, metadata }) {
  if (printToConsole) printLine({ userId, action, platform, deviceName, appVersion, metadata });
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
