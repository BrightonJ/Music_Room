// Queue + playback engine. The server is the single source of truth: it picks
// the next track, owns the timer and persists the state (restart-safe).
// Every exported mutation must run INSIDE withRoomLock(eventId).
const db = require('../config/db');
const deezer = require('../services/deezer');
const { getIO, roomName } = require('./ioState');
const { withRoomLock } = require('./roomLock');

const END_MARGIN_MS = 300;
const QUEUE_BROADCAST_DELAY_MS = 100;

const timers = new Map(); // eventId -> { timeout, trackId }
const pendingQueueBroadcasts = new Map(); // eventId -> timeout

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const key = (eventId) => String(eventId);

// ---------- reads ----------

async function getQueue(eventId) {
  const result = await db.query(
    `SELECT t.id, t.deezer_id, t.title, t.artist, t.cover_url, t.duration_ms, u.username AS added_by,
            COALESCE(SUM(v.value), 0)::int AS votes
     FROM tracks t
     LEFT JOIN track_votes v ON v.track_id = t.id
     LEFT JOIN users u ON u.id = t.user_id
     WHERE t.event_id = $1 AND t.status = 'queued'
     GROUP BY t.id, u.username
     ORDER BY votes DESC, t.created_at ASC, t.id ASC
     LIMIT 200`,
    [eventId]
  );
  return result.rows.map((r) => ({
    id: r.id,
    deezerId: Number(r.deezer_id),
    title: r.title,
    artist: r.artist,
    coverUrl: r.cover_url,
    durationMs: r.duration_ms,
    votes: r.votes,
    addedBy: r.added_by,
  }));
}

async function getUserVotes(eventId, userId) {
  const result = await db.query(
    `SELECT v.track_id, v.value FROM track_votes v
     JOIN tracks t ON t.id = v.track_id
     WHERE t.event_id = $1 AND t.status = 'queued' AND v.user_id = $2`,
    [eventId, userId]
  );
  const votes = {};
  for (const row of result.rows) votes[row.track_id] = row.value;
  return votes;
}

async function getPlaybackRow(eventId) {
  const result = await db.query(
    `SELECT ep.*, t.title, t.artist, t.cover_url, t.deezer_id
     FROM event_playback ep
     LEFT JOIN tracks t ON t.id = ep.current_track_id
     WHERE ep.event_id = $1`,
    [eventId]
  );
  return result.rows[0] || null;
}

function positionOf(row, now = Date.now()) {
  if (!row || !row.current_track_id) return 0;
  const duration = row.duration_ms || 0;
  if (row.is_playing && row.started_at) return clamp(now - new Date(row.started_at).getTime(), 0, duration);
  return clamp(row.position_ms || 0, 0, duration);
}

// The position is computed by the server at send time: clients do not need
// their clock to match the server's.
function serializePlayback(row) {
  const volume = row && row.volume != null ? Number(row.volume) : 1;
  if (!row || !row.current_track_id) return { nowPlaying: null, isPlaying: false, volume };
  return {
    nowPlaying: {
      track: {
        id: row.current_track_id,
        deezerId: Number(row.deezer_id),
        title: row.title,
        artist: row.artist,
        coverUrl: row.cover_url,
        previewUrl: row.preview_url,
      },
      durationMs: row.duration_ms,
      positionMs: positionOf(row),
    },
    isPlaying: row.is_playing,
    volume,
  };
}

async function getPlaybackState(eventId) {
  return serializePlayback(await getPlaybackRow(eventId));
}

// ---------- broadcasts ----------

async function emitPlayback(eventId) {
  const state = await getPlaybackState(eventId);
  const io = getIO();
  if (io) io.to(roomName(eventId)).emit('playback_update', { eventId: Number(eventId), ...state });
  return state;
}

async function emitQueue(eventId) {
  const tracks = await getQueue(eventId);
  const io = getIO();
  if (io) io.to(roomName(eventId)).emit('queue_update', { eventId: Number(eventId), tracks });
}

// Vote bursts: coalesce queue broadcasts (at most one every 100 ms per room).
// The broadcast re-reads the queue under the room lock, so it is always the
// most recent state and messages can never arrive out of order.
function scheduleQueueBroadcast(eventId) {
  const k = key(eventId);
  if (pendingQueueBroadcasts.has(k)) return;
  const timeout = setTimeout(() => {
    pendingQueueBroadcasts.delete(k);
    withRoomLock(eventId, () => emitQueue(eventId)).catch((err) => console.error('Queue broadcast failed:', err));
  }, QUEUE_BROADCAST_DELAY_MS);
  pendingQueueBroadcasts.set(k, timeout);
}

// ---------- timers ----------

function clearTimer(eventId) {
  const entry = timers.get(key(eventId));
  if (entry) {
    clearTimeout(entry.timeout);
    timers.delete(key(eventId));
  }
}

function scheduleEnd(eventId, trackId, delayMs) {
  clearTimer(eventId);
  const timeout = setTimeout(() => {
    withRoomLock(eventId, async () => {
      const entry = timers.get(key(eventId));
      // Stale timer (the track was skipped, paused, or another timer replaced it)
      if (!entry || entry.timeout !== timeout || entry.trackId !== trackId) return;
      timers.delete(key(eventId));
      const row = await getPlaybackRow(eventId);
      if (!row || row.current_track_id !== trackId || !row.is_playing) return;
      await advance(eventId);
    }).catch((err) => console.error(`Playback timer failed for event ${eventId}:`, err));
  }, Math.max(0, delayMs) + END_MARGIN_MS);
  timers.set(key(eventId), { timeout, trackId });
}

// ---------- mutations (call under the room lock) ----------

async function writeIdle(eventId, volume) {
  await db.query(
    `INSERT INTO event_playback (event_id, current_track_id, preview_url, started_at, position_ms, duration_ms, is_playing, volume)
     VALUES ($1, NULL, NULL, NULL, 0, NULL, false, $2)
     ON CONFLICT (event_id) DO UPDATE SET current_track_id = NULL, preview_url = NULL, started_at = NULL,
       position_ms = 0, duration_ms = NULL, is_playing = false`,
    [eventId, volume]
  );
}

// Ends the current track and starts the most voted one
async function advance(eventId) {
  clearTimer(eventId);
  await db.query(`UPDATE tracks SET status = 'played' WHERE event_id = $1 AND status = 'playing'`, [eventId]);
  const current = await db.query('SELECT volume FROM event_playback WHERE event_id = $1', [eventId]);
  const volume = current.rows[0] ? Number(current.rows[0].volume) : 1;

  for (let attempt = 0; attempt < 5; attempt++) {
    const next = await db.query(
      `SELECT t.id, t.deezer_id, t.duration_ms, COALESCE(SUM(v.value), 0) AS votes
       FROM tracks t LEFT JOIN track_votes v ON v.track_id = t.id
       WHERE t.event_id = $1 AND t.status = 'queued'
       GROUP BY t.id
       ORDER BY votes DESC, t.created_at ASC, t.id ASC
       LIMIT 1`,
      [eventId]
    );
    if (next.rows.length === 0) break;
    const track = next.rows[0];

    // Fresh, signed preview URL (the ones returned by a search expire quickly)
    let fresh = null;
    try {
      fresh = await deezer.getTrack(Number(track.deezer_id));
    } catch (err) {
      console.error(`Deezer lookup failed for track ${track.deezer_id}:`, err.message);
    }
    if (!fresh) {
      // Not playable anymore: skip it rather than blocking the room
      await db.query(`UPDATE tracks SET status = 'played' WHERE id = $1`, [track.id]);
      continue;
    }

    const durationMs = Math.min(track.duration_ms, fresh.durationMs) || track.duration_ms;
    const startedAt = new Date();
    await db.query(`UPDATE tracks SET status = 'playing' WHERE id = $1`, [track.id]);
    await db.query(
      `INSERT INTO event_playback (event_id, current_track_id, preview_url, started_at, position_ms, duration_ms, is_playing, volume)
       VALUES ($1, $2, $3, $4, 0, $5, true, $6)
       ON CONFLICT (event_id) DO UPDATE SET current_track_id = EXCLUDED.current_track_id,
         preview_url = EXCLUDED.preview_url, started_at = EXCLUDED.started_at, position_ms = 0,
         duration_ms = EXCLUDED.duration_ms, is_playing = true`,
      [eventId, track.id, fresh.previewUrl, startedAt, durationMs, volume]
    );
    scheduleEnd(eventId, track.id, durationMs);
    await emitPlayback(eventId);
    await emitQueue(eventId);
    return true;
  }

  await writeIdle(eventId, volume);
  await emitPlayback(eventId);
  await emitQueue(eventId);
  return false;
}

// Starts playing if nothing is currently loaded. Returns true if it advanced.
async function ensurePlaying(eventId) {
  const row = await getPlaybackRow(eventId);
  if (row && row.current_track_id) return false;
  await advance(eventId);
  return true;
}

async function pause(eventId) {
  const row = await getPlaybackRow(eventId);
  if (!row || !row.current_track_id || !row.is_playing) return;
  clearTimer(eventId);
  await db.query('UPDATE event_playback SET is_playing = false, position_ms = $2 WHERE event_id = $1', [
    eventId,
    Math.round(positionOf(row)),
  ]);
  await emitPlayback(eventId);
}

async function resume(eventId) {
  const row = await getPlaybackRow(eventId);
  if (!row || !row.current_track_id) {
    await advance(eventId); // nothing loaded: "play" starts the queue
    return;
  }
  if (row.is_playing) return;
  const position = clamp(row.position_ms || 0, 0, row.duration_ms);
  const remaining = row.duration_ms - position;
  if (remaining <= 0) {
    await advance(eventId);
    return;
  }
  // The pause may have lasted longer than the preview URL lifetime
  let previewUrl = row.preview_url;
  try {
    const fresh = await deezer.getTrack(Number(row.deezer_id));
    if (fresh) previewUrl = fresh.previewUrl;
  } catch (err) {
    console.error('Could not refresh the preview URL:', err.message);
  }
  await db.query(
    'UPDATE event_playback SET is_playing = true, started_at = $2, preview_url = $3 WHERE event_id = $1',
    [eventId, new Date(Date.now() - position), previewUrl]
  );
  scheduleEnd(eventId, row.current_track_id, remaining);
  await emitPlayback(eventId);
}

async function skip(eventId) {
  await advance(eventId);
}

async function setVolume(eventId, volume) {
  await db.query(
    `INSERT INTO event_playback (event_id, volume) VALUES ($1, $2)
     ON CONFLICT (event_id) DO UPDATE SET volume = EXCLUDED.volume`,
    [eventId, volume]
  );
  await emitPlayback(eventId);
}

// Called before an event is deleted
function stopPlayback(eventId) {
  clearTimer(eventId);
  const pending = pendingQueueBroadcasts.get(key(eventId));
  if (pending) {
    clearTimeout(pending);
    pendingQueueBroadcasts.delete(key(eventId));
  }
}

// On server start: re-arm the timers of the rooms that were playing
async function restoreAll() {
  const result = await db.query(
    `SELECT event_id FROM event_playback WHERE current_track_id IS NOT NULL AND is_playing = true`
  );
  for (const { event_id: eventId } of result.rows) {
    await withRoomLock(eventId, async () => {
      const row = await getPlaybackRow(eventId);
      if (!row || !row.current_track_id || !row.is_playing) return;
      const remaining = row.duration_ms - positionOf(row);
      if (remaining <= 0) {
        await advance(eventId);
        return;
      }
      try {
        const fresh = await deezer.getTrack(Number(row.deezer_id));
        if (fresh) await db.query('UPDATE event_playback SET preview_url = $2 WHERE event_id = $1', [eventId, fresh.previewUrl]);
      } catch (err) {
        console.error('Could not refresh the preview URL:', err.message);
      }
      scheduleEnd(eventId, row.current_track_id, remaining);
    }).catch((err) => console.error(`Could not restore playback of event ${eventId}:`, err));
  }
  return result.rows.length;
}

// Tests / graceful shutdown
function stopAll() {
  for (const { timeout } of timers.values()) clearTimeout(timeout);
  timers.clear();
  for (const timeout of pendingQueueBroadcasts.values()) clearTimeout(timeout);
  pendingQueueBroadcasts.clear();
}

module.exports = {
  getQueue,
  getUserVotes,
  getPlaybackState,
  emitQueue,
  emitPlayback,
  scheduleQueueBroadcast,
  advance,
  ensurePlaying,
  pause,
  resume,
  skip,
  setVolume,
  stopPlayback,
  restoreAll,
  stopAll,
};
