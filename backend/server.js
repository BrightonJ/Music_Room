require('dotenv').config({ quiet: true });

const secret = process.env.JWT_SECRET;
if (!secret || secret === 'CHANGE_ME' || secret.length < 32) {
  console.error('JWT_SECRET is missing or too weak. Put at least 32 random characters in backend/.env (openssl rand -hex 32).');
  process.exit(1);
}

const pool = require('./config/db');
const { start } = require('./bootstrap');

(async () => {
  try {
    await pool.query('SELECT 1');
    console.log('✅ Connected to PostgreSQL');
  } catch (err) {
    console.error('❌ PostgreSQL is unreachable:', err.message);
    process.exit(1);
  }

  const { port, close } = await start();
  const base = (process.env.PUBLIC_URL || `http://localhost:${port}`).replace(/\/+$/, '');
  console.log(`✅ API + WebSockets listening on port ${port}`);
  console.log(`📚 API documentation: ${base}/api-docs`);
  if (!process.env.SMTP_HOST) console.warn('⚠️  SMTP_HOST is not set: emails are printed in this console instead of being sent.');

  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    await close();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
})();
