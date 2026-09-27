// Real-time load test: every client joins the same room and votes at a regular
// pace. Measures the acknowledgement latency (p50/p95/p99), the errors, and the
// broadcasts received.
//   CLIENTS=200 DURATION=60 VOTE_INTERVAL_MS=2000 node bench/socket-load.js
const fs = require('fs');
const path = require('path');
const { io } = require('socket.io-client');

const file = path.join(__dirname, 'sessions.json');
if (!fs.existsSync(file)) {
  console.error('Run "npm run bench:seed" first.');
  process.exit(1);
}
const { api, eventId, trackIds, sessions } = JSON.parse(fs.readFileSync(file, 'utf8'));
const CLIENTS = Math.min(Number(process.env.CLIENTS) || sessions.length, sessions.length);
const DURATION_S = Number(process.env.DURATION) || 30;
const VOTE_INTERVAL_MS = Number(process.env.VOTE_INTERVAL_MS) || 2000;
const CONNECT_BATCH = 25;

const latencies = [];
let errors = 0;
let timeouts = 0;
let queueUpdates = 0;
let connected = 0;

const percentile = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : 0);

function connectClient(session) {
  return new Promise((resolve) => {
    const socket = io(api, { transports: ['websocket'], auth: { token: session.token, appVersion: 'bench' }, forceNew: true, reconnection: false });
    socket.on('queue_update', () => { queueUpdates += 1; });
    socket.once('connect', async () => {
      try {
        const ack = await socket.timeout(10000).emitWithAck('join_room', { roomId: eventId });
        if (ack.ok) connected += 1;
        else errors += 1;
      } catch {
        timeouts += 1;
      }
      resolve(socket);
    });
    socket.once('connect_error', (err) => {
      errors += 1;
      console.error('connect_error:', err.message);
      resolve(null);
    });
  });
}

async function voteLoop(socket, stopAt) {
  while (Date.now() < stopAt) {
    await new Promise((r) => setTimeout(r, VOTE_INTERVAL_MS * (0.5 + Math.random())));
    const trackId = trackIds[Math.floor(Math.random() * trackIds.length)];
    const value = [1, -1, 0][Math.floor(Math.random() * 3)];
    const started = process.hrtime.bigint();
    try {
      const ack = await socket.timeout(10000).emitWithAck('vote_track', { roomId: eventId, trackId, value });
      latencies.push(Number(process.hrtime.bigint() - started) / 1e6);
      if (!ack.ok) errors += 1;
    } catch {
      timeouts += 1;
    }
  }
}

(async () => {
  console.log(`Connecting ${CLIENTS} clients to ${api} (room ${eventId})...`);
  const clients = [];
  const connectStart = Date.now();
  for (let i = 0; i < CLIENTS; i += CONNECT_BATCH) {
    clients.push(...(await Promise.all(sessions.slice(i, Math.min(i + CONNECT_BATCH, CLIENTS)).map(connectClient))));
  }
  const live = clients.filter(Boolean);
  console.log(`${connected}/${CLIENTS} clients joined in ${Date.now() - connectStart} ms. Voting for ${DURATION_S}s...`);

  queueUpdates = 0;
  const started = Date.now();
  await Promise.all(live.map((s) => voteLoop(s, started + DURATION_S * 1000)));
  const elapsed = (Date.now() - started) / 1000;
  live.forEach((s) => s.disconnect());

  const sorted = [...latencies].sort((a, b) => a - b);
  const total = latencies.length + timeouts;
  console.log('\n--- Results ---');
  console.log(`clients joined      : ${connected}/${CLIENTS}`);
  console.log(`votes sent          : ${total} (${(total / elapsed).toFixed(1)} votes/s)`);
  console.log(`errors / timeouts   : ${errors} / ${timeouts} (${total ? (((errors + timeouts) / total) * 100).toFixed(2) : 0} %)`);
  console.log(`ack latency (ms)    : p50 ${percentile(sorted, 50).toFixed(1)}  p95 ${percentile(sorted, 95).toFixed(1)}  p99 ${percentile(sorted, 99).toFixed(1)}  max ${(sorted[sorted.length - 1] || 0).toFixed(1)}`);
  console.log(`queue broadcasts    : ${queueUpdates} received (${live.length ? (queueUpdates / live.length / elapsed).toFixed(2) : 0} per client per second)`);
  process.exit(0);
})();
