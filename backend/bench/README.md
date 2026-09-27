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

## 4. Results (fill in)

Machine: ...

| Clients in one room | votes/s | p50 (ms) | p95 (ms) | p99 (ms) | errors |
|---|---|---|---|---|---|
| 50  | | | | | |
| 100 | | | | | |
| 200 | | | | | |
| 300 | | | | | |

| REST concurrency | req/s /api/events | p95 (ms) | failed |
|---|---|---|---|
| 50  | | | |
| 100 | | | |
| 200 | | | |

**Conclusion**: the backend supports about ... simultaneous users on this machine.

## What limits the scaling (to discuss at the defense)

- One Node process: all the sockets share one CPU core. Next step: several processes
  behind a load balancer with the Socket.IO Redis adapter — but the per-room lock and the
  playback timers are in memory, so a room must then be pinned to one process.
- Each vote is serialized per room (consistency first); queue broadcasts are coalesced
  (at most every 100 ms) so the fan-out does not grow with the number of votes.
- PostgreSQL pool size: `DB_POOL_MAX` (default 20).
- Every REST call checks the device session in the database (instant revocation);
  that is one indexed primary-key query per call.
