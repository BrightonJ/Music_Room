const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { JWT_SECRET } = require('../middleware/auth');
const { setIO } = require('./ioState');
const { canAccessEvent, getQueueForEvent, getPlaybackState, hasPlaybackControl, canVoteOnEvent } = require('../models/events');
const { getPlaybackControlState, broadcastRoomMembers, playNext } = require('./playback');
const { registerDevice } = require('../models/devices');
const { logActivity } = require('../services/activityLog');

function initSocket(server, allowedOrigins) {
    const io = new Server(server, {
        cors: {
            origin: allowedOrigins.length ? allowedOrigins : true,
            methods: ["GET", "POST"]
        }
    });

    setIO(io);

    io.use((socket, next) => {
        const auth = socket.handshake.auth || {};
        const { token, deviceId, platform, deviceName, appVersion } = auth;
        if (!token || !deviceId) return next(new Error('Authentication required'));

        jwt.verify(token, JWT_SECRET, async (err, payload) => {
            if (err) return next(new Error('Invalid or expired token'));
            socket.data.userId = payload.userId;

            try {
                const deviceRowId = await registerDevice(payload.userId, deviceId, platform, deviceName);
                socket.data.deviceRowId = deviceRowId;
                socket.data.deviceName = deviceName || 'Unknown device';
                socket.data.platform = platform || 'unknown';
                socket.data.appVersion = appVersion || 'dev';
                next();
            } catch (dbErr) {
                next(new Error('Device registration failed'));
            }
        });
    });

    io.on('connection', (socket) => {
        const logSocketAction = (action, metadata) => {
            logActivity({
                userId: socket.data.userId,
                action,
                platform: socket.data.platform,
                deviceName: socket.data.deviceName,
                appVersion: socket.data.appVersion,
                metadata,
            });
        };

        socket.on('join_room', async (roomId) => {
            try {
                const event = await canAccessEvent(socket.data.userId, roomId);
                if (!event) {
                    socket.emit('room_error', 'Access denied');
                    return;
                }

                socket.join(String(roomId));
                socket.data.eventId = roomId;
                logSocketAction('socket.join_room', { roomId });

                const queue = await getQueueForEvent(roomId);
                socket.emit('update_queue', queue);

                const playback = await getPlaybackState(roomId);
                socket.emit('now_playing', playback);
                socket.emit('playback_control_update', getPlaybackControlState(roomId));

                await broadcastRoomMembers(roomId);
            } catch (err) { console.error(err); }
        });

        socket.on('add_track', async (trackData) => {
            try {
                const { roomId, title, artist, coverUrl, previewUrl, durationMs } = trackData;
                const event = await canAccessEvent(socket.data.userId, roomId);
                if (!event) {
                    socket.emit('room_error', 'Access denied');
                    return;
                }

                const existing = await db.query(
                    'SELECT id FROM tracks WHERE event_id = $1 AND played = false AND title = $2 AND artist = $3',
                    [roomId, title, artist]
                );
                if (existing.rows.length > 0) {
                    socket.emit('room_error', 'Track already in the queue');
                    return;
                }

                await db.query(
                    'INSERT INTO tracks (event_id, user_id, title, artist, cover_url, preview_url, duration_ms) VALUES ($1,$2,$3,$4,$5,$6,$7)',
                    [roomId, socket.data.userId, title, artist, coverUrl || null, previewUrl || null, durationMs || 30000]
                );
                logSocketAction('socket.add_track', { roomId, title, artist });

                const queue = await getQueueForEvent(roomId);
                io.to(String(roomId)).emit('update_queue', queue);

                const playback = await getPlaybackState(roomId);
                if (!playback) {
                    await playNext(roomId);
                }
            } catch (err) { console.error(err); }
        });

        socket.on('vote_track', async ({ trackId, roomId, value, lat, lng }) => {
            try {
                const event = await canAccessEvent(socket.data.userId, roomId);
                if (!event) {
                    socket.emit('room_error', 'Access denied');
                    return;
                }

                if (![1, -1, 0].includes(value)) return;

                if (value !== 0) {
                    const eligibility = await canVoteOnEvent(event, lat, lng);
                    if (!eligibility.allowed) {
                        socket.emit('room_error', eligibility.reason);
                        return;
                    }
                }

                if (value === 0) {
                    await db.query('DELETE FROM track_votes WHERE track_id = $1 AND user_id = $2', [trackId, socket.data.userId]);
                } else {
                    await db.query(
                        `INSERT INTO track_votes (track_id, user_id, value) VALUES ($1, $2, $3)
                         ON CONFLICT (track_id, user_id) DO UPDATE SET value = $3`,
                        [trackId, socket.data.userId, value]
                    );
                }
                logSocketAction('socket.vote_track', { roomId, trackId, value });

                const queue = await getQueueForEvent(roomId);
                io.to(String(roomId)).emit('update_queue', queue);
            } catch (err) { console.error(err); }
        });

        socket.on('control_playback', async ({ roomId, action }) => {
            try {
                const allowed = await hasPlaybackControl(socket.data.userId, roomId, socket.data.deviceRowId);
                if (!allowed) {
                    socket.emit('room_error', 'You do not have control of this room');
                    return;
                }
                if (!['play', 'pause'].includes(action)) return;

                const state = getPlaybackControlState(roomId);
                state.isPlaying = action === 'play';
                logSocketAction('socket.control_playback', { roomId, action });
                io.to(String(roomId)).emit('playback_control_update', state);
            } catch (err) { console.error(err); }
        });

        socket.on('control_volume', async ({ roomId, volume }) => {
            try {
                const allowed = await hasPlaybackControl(socket.data.userId, roomId, socket.data.deviceRowId);
                if (!allowed) {
                    socket.emit('room_error', 'You do not have control of this room');
                    return;
                }

                const clamped = Math.max(0, Math.min(1, Number(volume)));
                if (Number.isNaN(clamped)) return;

                const state = getPlaybackControlState(roomId);
                state.volume = clamped;
                logSocketAction('socket.control_volume', { roomId, volume: clamped });
                io.to(String(roomId)).emit('playback_control_update', state);
            } catch (err) { console.error(err); }
        });

        socket.on('disconnect', () => {
            if (socket.data.eventId) {
                broadcastRoomMembers(socket.data.eventId).catch(err => console.error(err));
            }
        });
    });

    return io;
}

module.exports = { initSocket };