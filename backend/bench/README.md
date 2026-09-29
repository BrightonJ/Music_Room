# Ramp-up tests (subject V.7)

Goal: find how many users the backend handles on a given machine before the
response time or the error rate becomes unacceptable.

**Acceptance criteria used**: p95 latency < 200 ms and less than 1 % errors.

## 1. Prepare

```bash
# Terminal 1: API with the rate limits disabled (the load comes from one IP)
cd backend
RATE_LIMIT_DISABLED=1 npm start

# Terminal 2: create 300 users, one room with 50 tracks, 300 sessions
cd backend
npm run bench:seed -- 300
```

Note the machine: `lscpu | grep 'Model name'`, `nproc`, `free -h`, and PostgreSQL in Podman/Docker or not.

## 2. Real-time (the critical path of the app)

Every client joins the same room and votes about every 2 s (like a very active party):

```bash
CLIENTS=50  DURATION=60 npm run bench:sockets
CLIENTS=100 DURATION=60 npm run bench:sockets
CLIENTS=200 DURATION=60 npm run bench:sockets
CLIENTS=300 DURATION=60 npm run bench:sockets
```

Increase `CLIENTS` (re-seed with more users if needed) until the criteria break.

## 3. REST

```bash
N=5000 C=50  ./bench/rest-ab.sh
N=5000 C=100 ./bench/rest-ab.sh
N=5000 C=200 ./bench/rest-ab.sh
```

## 4. Results

Measured on 2026-09-29. **Machine**: MacBook with an Apple M1 (8 cores), 8 GB RAM, macOS 26, Node.js 23.
PostgreSQL 15 in Docker (VM limited to 4 CPU / 4 GB). The load clients ran **on the same machine** as
the server, so they competed with it for CPU: a dedicated server would do better.
API started with `RATE_LIMIT_DISABLED=1 LOG_TO_CONSOLE=0` (the activity log is still written to the database).

### Real time: all the clients in ONE room, each one voting every ~2 s

| Clients in one room | votes/s | p50 (ms) | p95 (ms) | p99 (ms) | errors / timeouts | Result |
|---|---|---|---|---|---|---|
| 50  | 24.4  | 7.9 | 17.6 | 29.8  | 0 %    | OK |
| 100 | 48.4  | 7.7 | 19.4 | 35.8  | 0 %    | OK |
| 200 | 96.4  | 5.6 | 20.1 | 29.0  | 0 %    | OK |
| 300 | 144.7 | 4.2 | 20.7 | 41.7  | 0 %    | OK |
| 500 | 236.2 | 2.5 | 49.7 | 345.5 | 0 %    | OK (p95 < 200 ms) |
| 750 | 106.1 | 6.0 | 4440.6 | 8990.6 | 40.9 % | **KO** |

At 750 clients the 750 connections alone took 63 s to open, and 41 % of the votes timed out (10 s):
the single Node process is saturated. The first real-time run of a session can be slower (cold start):
the numbers above come from warm runs.

### REST (ApacheBench, 5000 requests, 100 concurrent connections)

| Route | req/s | p50 (ms) | p95 (ms) | p99 (ms) | failed |
|---|---|---|---|---|---|
| `GET /api/health` (no auth, no DB) | 3136 | 25 | 42  | 250 | 0 |
| `GET /api/events` (rooms list)     | 1181 | 68 | 186 | 323 | 0 |
| `GET /api/profile`                  | 1367 | 60 | 169 | 273 | 0 |
| `GET /api/events/:id` (room detail) | 659  | 114 | 318 | 567 | 0 |

100 connections firing requests back to back is far heavier than 100 users (a real user sends a request
every few seconds). `GET /api/events/:id` is the slowest: it runs 4 queries (access check, owner, control
on this device, invitation).

**Conclusion**: on this machine the backend handles about **500 simultaneous users voting in the same room**
(p95 50 ms, 0 error), and breaks between 500 and 750. Users spread over several rooms, or less active than
one vote every 2 s, would allow more. The REST API serves about **1,200 requests/s** on the rooms list with
no error.

## What limits the scaling (to discuss at the defense)

- One Node process: all the sockets share one CPU core. Next step: several processes
  behind a load balancer with the Socket.IO Redis adapter — but the per-room lock and the
  playback timers are in memory, so a room must then be pinned to one process.
- Each vote is serialized per room (consistency first); queue broadcasts are coalesced
  (at most every 100 ms) so the fan-out does not grow with the number of votes.
- PostgreSQL pool size: `DB_POOL_MAX` (default 20).
- Every REST call checks the device session in the database (instant revocation);
  that is one indexed primary-key query per call.
