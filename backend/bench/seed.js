// Prepares a load test: N verified users, one public room with queued tracks,
// and one logged-in session per user, saved in bench/sessions.json.
// The API must be running with RATE_LIMIT_DISABLED=1.
//   node bench/seed.js 300
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const bcrypt = require('bcrypt');
const pool = require('../config/db');

const USERS = Number(process.argv[2]) || 200;
const TRACKS = 50;
const API = (process.env.BENCH_API_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, '');
const PASSWORD = 'Bench-Passw0rd!';

async function loginAll(users) {
  const sessions = [];
  const queue = [...users];
  async function worker() {
    while (queue.length) {
      const user = queue.shift();
      const res = await fetch(`${API}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Device-Id': crypto.randomUUID(), 'X-Platform': 'bench', 'X-Device': 'load test' },
        body: JSON.stringify({ email: user.email, password: PASSWORD }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`Login failed for ${user.email}: ${data.error}`);
      sessions.push({ userId: user.id, token: data.token });
    }
  }
  await Promise.all(Array.from({ length: 10 }, worker));
  return sessions;
}

(async () => {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const users = [];
  for (let i = 1; i <= USERS; i++) {
    const email = `bench_${i}@bench.local`;
    const r = await pool.query(
      `INSERT INTO users (email, username, password, first_name, last_name, is_verified)
       VALUES ($1, $2, $3, 'Bench', 'User', true)
       ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, is_verified = true
       RETURNING id`,
      [email, `bench_${i}`, hash]
    );
    users.push({ id: r.rows[0].id, email });
  }

  const event = await pool.query(
    `INSERT INTO events (owner_id, name, is_private) VALUES ($1, $2, false) RETURNING id`,
    [users[0].id, `Bench room ${new Date().toISOString()}`]
  );
  const eventId = event.rows[0].id;
  const trackIds = [];
  for (let i = 0; i < TRACKS; i++) {
    const r = await pool.query(
      `INSERT INTO tracks (event_id, user_id, deezer_id, title, artist, duration_ms)
       VALUES ($1, $2, $3, $4, 'Bench', 30000) RETURNING id`,
      [eventId, users[0].id, 900000000 + i, `Bench track ${i}`]
    );
    trackIds.push(r.rows[0].id);
  }

  const sessions = await loginAll(users);
  fs.writeFileSync(path.join(__dirname, 'sessions.json'), JSON.stringify({ api: API, eventId, trackIds, sessions }, null, 2));
  console.log(`Seeded ${users.length} users, room ${eventId} with ${TRACKS} tracks -> bench/sessions.json`);
  await pool.end();
})().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
