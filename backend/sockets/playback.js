const db = require('../config/db');
const { getIO } = require('./ioState');
const { getQueueForEvent } = require('../models/events');

const playbackTimers = {};
const roomPlaybackState = {};

function getPlaybackControlState(eventId) {
    if (!roomPlaybackState[eventId]) {
        roomPlaybackState[eventId] = { isPlaying: true, volume: 1 };
    }
    return roomPlaybackState[eventId];
}

function clearPlaybackState(eventId) {
    if (playbackTimers[eventId]) {
        clearTimeout(playbackTimers[eventId]);
        delete playbackTimers[eventId];
    }
    delete roomPlaybackState[eventId];
}

async function broadcastRoomMembers(eventId) {
    const io = getIO();
    const sockets = await io.in(String(eventId)).fetchSockets();

    const byUser = new Map();
    for (const s of sockets) {
        if (!byUser.has(s.data.userId)) {
            byUser.set(s.data.userId, { deviceId: s.data.deviceRowId, deviceName: s.data.deviceName });
        }
    }

    const userIds = [...byUser.keys()];
    if (userIds.length === 0) {
        io.to(String(eventId)).emit('room_members', []);
        return;
    }

    const eventResult = await db.query('SELECT owner_id FROM events WHERE id = $1', [eventId]);
    const ownerId = eventResult.rows[0] ? eventResult.rows[0].owner_id : null;

    const usersResult = await db.query(
        `SELECT id, username FROM users WHERE id = ANY($1::int[])`,
        [userIds]
    );

    const delegationsResult = await db.query(
        `SELECT user_id, device_id FROM event_delegations WHERE event_id = $1`,
        [eventId]
    );
    const delegationMap = new Map(delegationsResult.rows.map(r => [r.user_id, r.device_id]));

    const members = usersResult.rows.map(u => {
        const connection = byUser.get(u.id);
        const delegatedDeviceId = delegationMap.get(u.id);
        const hasControl = u.id === ownerId || (delegatedDeviceId != null && delegatedDeviceId === connection.deviceId);
        return {
            id: u.id,
            username: u.username,
            isOwner: u.id === ownerId,
            deviceName: connection.deviceName,
            hasControl
        };
    });

    io.to(String(eventId)).emit('room_members', members);
}

async function playNext(roomId) {
    const io = getIO();

    if (playbackTimers[roomId]) {
        clearTimeout(playbackTimers[roomId]);
        delete playbackTimers[roomId];
    }

    const current = await db.query('SELECT current_track_id FROM event_playback WHERE event_id = $1', [roomId]);
    if (current.rows.length && current.rows[0].current_track_id) {
        await db.query('UPDATE tracks SET played = true WHERE id = $1', [current.rows[0].current_track_id]);
    }

    const queue = await getQueueForEvent(roomId);

    if (queue.length === 0) {
        await db.query(
            `INSERT INTO event_playback (event_id, current_track_id, started_at, duration_ms) VALUES ($1, NULL, NULL, NULL)
             ON CONFLICT (event_id) DO UPDATE SET current_track_id = NULL, started_at = NULL, duration_ms = NULL`,
            [roomId]
        );
        io.to(String(roomId)).emit('now_playing', null);
        io.to(String(roomId)).emit('update_queue', []);
        return;
    }

    const next = queue[0];
    const durationMs = next.duration_ms || 30000;
    const startedAt = new Date();

    await db.query(
        `INSERT INTO event_playback (event_id, current_track_id, started_at, duration_ms) VALUES ($1, $2, $3, $4)
         ON CONFLICT (event_id) DO UPDATE SET current_track_id = $2, started_at = $3, duration_ms = $4`,
        [roomId, next.id, startedAt, durationMs]
    );

    const remainingQueue = await getQueueForEvent(roomId);

    io.to(String(roomId)).emit('now_playing', {
        track: { id: next.id, title: next.title, artist: next.artist, coverUrl: next.cover_url, previewUrl: next.preview_url },
        startedAt: startedAt.toISOString(),
        durationMs
    });
    io.to(String(roomId)).emit('update_queue', remainingQueue);

    const controlState = getPlaybackControlState(roomId);
    controlState.isPlaying = true;
    io.to(String(roomId)).emit('playback_control_update', controlState);

    playbackTimers[roomId] = setTimeout(() => {
        playNext(roomId).catch(err => console.error(err));
    }, durationMs);
}

module.exports = {
    getPlaybackControlState,
    clearPlaybackState,
    broadcastRoomMembers,
    playNext,
    playbackTimers,
};