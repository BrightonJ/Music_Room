const db = require('../config/db');
const { haversineDistanceMeters, isWithinTimeWindow } = require('../utils/geo');

async function canAccessEvent(userId, eventId) {
    const result = await db.query(
        `SELECT e.* FROM events e
         LEFT JOIN event_invitations ei ON ei.event_id = e.id AND ei.user_id = $2 AND ei.status = 'accepted'
         WHERE e.id = $1 AND (e.is_private = false OR e.owner_id = $2 OR ei.user_id = $2)`,
        [eventId, userId]
    );
    return result.rows[0] || null;
}

async function getQueueForEvent(eventId) {
    const result = await db.query(
        `SELECT t.id, t.event_id, t.user_id, t.title, t.artist, t.cover_url, t.preview_url, t.duration_ms,
                COALESCE(SUM(tv.value), 0)::int AS votes
         FROM tracks t
         LEFT JOIN track_votes tv ON tv.track_id = t.id
         WHERE t.event_id = $1 AND t.played = false
         GROUP BY t.id
         ORDER BY votes DESC, t.created_at ASC`,
        [eventId]
    );
    return result.rows;
}

async function getPlaybackState(eventId) {
    const result = await db.query(
        `SELECT ep.started_at, ep.duration_ms, t.id, t.title, t.artist, t.cover_url, t.preview_url
         FROM event_playback ep
         JOIN tracks t ON t.id = ep.current_track_id
         WHERE ep.event_id = $1`,
        [eventId]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
        track: { id: row.id, title: row.title, artist: row.artist, coverUrl: row.cover_url, previewUrl: row.preview_url },
        startedAt: row.started_at,
        durationMs: row.duration_ms
    };
}

async function hasPlaybackControl(userId, eventId, deviceRowId) {
    const event = await db.query('SELECT owner_id FROM events WHERE id = $1', [eventId]);
    if (event.rows.length === 0) return false;
    if (event.rows[0].owner_id === userId) return true;
    if (!deviceRowId) return false;
    const delegation = await db.query(
        'SELECT id FROM event_delegations WHERE event_id = $1 AND user_id = $2 AND device_id = $3',
        [eventId, userId, deviceRowId]
    );
    return delegation.rows.length > 0;
}

async function canVoteOnEvent(event, userLat, userLng) {
    if (!event.location_restricted) return { allowed: true };

    if (!isWithinTimeWindow(event.vote_window_start, event.vote_window_end)) {
        return { allowed: false, reason: "Voting is only open during the event's time window" };
    }

    if (event.location_lat == null || event.location_lng == null) {
        return { allowed: false, reason: "Event location is not configured" };
    }

    if (userLat == null || userLng == null) {
        return { allowed: false, reason: "Location required to vote in this event" };
    }

    const distance = haversineDistanceMeters(event.location_lat, event.location_lng, userLat, userLng);
    if (distance > (event.location_radius_m || 100)) {
        return { allowed: false, reason: "You must be near the event to vote" };
    }

    return { allowed: true };
}

module.exports = { canAccessEvent, getQueueForEvent, getPlaybackState, hasPlaybackControl, canVoteOnEvent };