const { Server } = require('socket.io');
const db = require('../config/db');
const { setIO, roomName, userRoomName } = require('./ioState');
const { withRoomLock } = require('./roomLock');
const playback = require('./playback');
const { broadcastRoomMembers } = require('./presence');
const { canAccessEvent, hasPlaybackControl, evaluateVoteLicense } = require('../models/events');
const deezer = require('../services/deezer');
const { verifySession } = require('../services/session');
const { logActivity } = require('../services/activityLog');
const { ClientError } = require('../utils/errors');
const { parseId } = require('../utils/validators');
const { createTokenBucket } = require('../utils/tokenBucket');

const MAX_QUEUE = 200;
const LOGGED_KEYS = ['roomId', 'trackId', 'value', 'action', 'volume', 'deezerId'];

function pickLogMetadata(payload) {
  const metadata = {};
  for (const k of LOGGED_KEYS) {
    if (typeof payload[k] === 'number' || typeof payload[k] === 'string') metadata[k] = payload[k];
  }
  return metadata;
}

const logError = (err) => console.error(err);

function initSocket(server) {
  const io = new Server(server, { maxHttpBufferSize: 1e5, serveClient: false });
  setIO(io);

  // Same session check as the REST API: a removed / logged out device is refused
  io.use(async (socket, next) => {
    try {
      const { token, appVersion } = socket.handshake.auth || {};
      if (typeof token !== 'string' || !token) return next(new Error('Authentication required'));
      const session = await verifySession(token);
      if (!session) return next(new Error('Session expired or revoked'));
      socket.data.userId = session.userId;
      socket.data.deviceRowId = session.deviceId;
      socket.data.deviceName = session.deviceName;
      socket.data.platform = session.platform;
      socket.data.appVersion = typeof appVersion === 'string' ? appVersion.slice(0, 20) : 'unknown';
      socket.data.eventId = null;
      await db.query('UPDATE devices SET last_seen_at = NOW() WHERE id = $1', [session.deviceId]);
      next();
    } catch (err) {
      console.error('Socket authentication failed:', err);
      next(new Error('Server error'));
    }
  });

  io.on('connection', (socket) => {
    const bucket = createTokenBucket({
      capacity: 20,
      refillPerSecond: 10,
      enabled: process.env.RATE_LIMIT_DISABLED !== '1',
    });
    const log = (action, metadata) =>
      logActivity({
        userId: socket.data.userId,
        action,
        platform: socket.data.platform,
        deviceName: socket.data.deviceName,
        appVersion: socket.data.appVersion,
        metadata,
      });
    log('socket.connect');
    // Personal channel for notifications that are not tied to a room (friends...)
    socket.join(userRoomName(socket.data.userId));

    // Every event answers through an acknowledgement: { ok: true, ... } or { ok: false, error }
    const on = (name, handler) => {
      socket.on(name, async (payload, ack) => {
        const reply = typeof ack === 'function' ? ack : () => {};
        const data = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
        if (!bucket.take()) {
          reply({ ok: false, error: 'Too many actions, slow down' });
          return;
        }
        try {
          const result = await handler(data);
          log(`socket.${name}`, { ...pickLogMetadata(data), ok: true });
          reply({ ok: true, ...(result || {}) });
        } catch (err) {
          if (err instanceof ClientError) {
            log(`socket.${name}`, { ...pickLogMetadata(data), ok: false, error: err.message });
            reply({ ok: false, error: err.message });
          } else {
            console.error(`Socket event ${name} failed:`, err);
            reply({ ok: false, error: 'Server error' });
          }
        }
      });
    };

    async function requireRoom(roomId) {
      const eventId = parseId(roomId);
      if (!eventId) throw new ClientError('Invalid room');
      const event = await canAccessEvent(socket.data.userId, eventId);
      if (!event) throw new ClientError('Room not found or access denied');
      return event;
    }

    async function requireControl(event) {
      const allowed = await hasPlaybackControl(socket.data.userId, event.id, socket.data.deviceRowId);
      if (!allowed) throw new ClientError('You do not have control of this room on this device');
    }

    on('join_room', async ({ roomId }) => {
      const event = await requireRoom(roomId);
      const previous = socket.data.eventId;
      if (previous && previous !== event.id) {
        socket.leave(roomName(previous));
        broadcastRoomMembers(previous).catch(logError);
      }
      // The snapshot is read and sent under the lock: no broadcast can slip in
      // between and be overwritten by an older state.
      await withRoomLock(event.id, async () => {
        socket.join(roomName(event.id));
        socket.data.eventId = event.id;
        const [tracks, state, votes] = await Promise.all([
          playback.getQueue(event.id),
          playback.getPlaybackState(event.id),
          playback.getUserVotes(event.id, socket.data.userId),
        ]);
        socket.emit('queue_update', { eventId: event.id, tracks });
        socket.emit('playback_update', { eventId: event.id, ...state });
        socket.emit('my_votes', { eventId: event.id, votes });
      });
      await broadcastRoomMembers(event.id);
      return { eventId: event.id, deviceId: socket.data.deviceRowId, isOwner: event.owner_id === socket.data.userId };
    });

    on('leave_room', async () => {
      const previous = socket.data.eventId;
      if (!previous) return;
      socket.leave(roomName(previous));
      socket.data.eventId = null;
      await broadcastRoomMembers(previous);
    });

    // The client only sends a Deezer id: metadata and duration come from Deezer
    on('add_track', async ({ roomId, deezerId }) => {
      const event = await requireRoom(roomId);
      const id = Number(deezerId);
      if (!Number.isSafeInteger(id) || id <= 0) throw new ClientError('Invalid track');

      let track;
      try {
        track = await deezer.getTrack(id);
      } catch {
        throw new ClientError('The music catalog is unavailable, try again');
      }
      if (!track) throw new ClientError('This track has no preview available');

      return withRoomLock(event.id, async () => {
        const count = await db.query(`SELECT COUNT(*)::int AS n FROM tracks WHERE event_id = $1 AND status = 'queued'`, [event.id]);
        if (count.rows[0].n >= MAX_QUEUE) throw new ClientError('The queue is full');
        // The partial unique index settles concurrent additions of the same track
        const inserted = await db.query(
          `INSERT INTO tracks (event_id, user_id, deezer_id, title, artist, cover_url, duration_ms)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [event.id, socket.data.userId, track.deezerId, track.title, track.artist, track.coverUrl, track.durationMs]
        );
        if (inserted.rows.length === 0) throw new ClientError('This track is already in the queue');
        const started = await playback.ensurePlaying(event.id);
        if (!started) await playback.emitQueue(event.id);
        return { trackId: inserted.rows[0].id };
      });
    });

    on('vote_track', async ({ roomId, trackId, value, lat, lng }) => {
      const event = await requireRoom(roomId);
      const tid = parseId(trackId);
      if (!tid) throw new ClientError('Invalid track');
      if (![1, -1, 0].includes(value)) throw new ClientError('Invalid vote');
      if (value !== 0) {
        const license = await evaluateVoteLicense(event, socket.data.userId, lat, lng);
        if (!license.allowed) throw new ClientError(license.reason);
      }
      await withRoomLock(event.id, async () => {
        // The track must belong to THIS room and still be waiting in its queue
        const track = await db.query(`SELECT 1 FROM tracks WHERE id = $1 AND event_id = $2 AND status = 'queued'`, [tid, event.id]);
        if (track.rows.length === 0) throw new ClientError('This track is no longer in the queue');
        if (value === 0) {
          await db.query('DELETE FROM track_votes WHERE track_id = $1 AND user_id = $2', [tid, socket.data.userId]);
        } else {
          await db.query(
            `INSERT INTO track_votes (track_id, user_id, value) VALUES ($1, $2, $3)
             ON CONFLICT (track_id, user_id) DO UPDATE SET value = EXCLUDED.value, created_at = NOW()`,
            [tid, socket.data.userId, value]
          );
        }
        playback.scheduleQueueBroadcast(event.id);
      });
      return { trackId: tid, value };
    });

    on('control_playback', async ({ roomId, action }) => {
      if (!['play', 'pause', 'next'].includes(action)) throw new ClientError('Invalid action');
      const event = await requireRoom(roomId);
      await requireControl(event);
      await withRoomLock(event.id, async () => {
        if (action === 'pause') await playback.pause(event.id);
        else if (action === 'play') await playback.resume(event.id);
        else await playback.skip(event.id);
      });
    });

    on('control_volume', async ({ roomId, volume }) => {
      if (typeof volume !== 'number' || !Number.isFinite(volume)) throw new ClientError('Invalid volume');
      const event = await requireRoom(roomId);
      await requireControl(event);
      const clamped = Math.round(Math.min(1, Math.max(0, volume)) * 100) / 100;
      await withRoomLock(event.id, () => playback.setVolume(event.id, clamped));
      return { volume: clamped };
    });

    socket.on('disconnect', () => {
      log('socket.disconnect');
      if (socket.data.eventId) broadcastRoomMembers(socket.data.eventId).catch(logError);
    });
  });

  return io;
}

module.exports = { initSocket };
