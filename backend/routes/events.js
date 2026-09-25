const express = require('express');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { canAccessEvent } = require('../models/events');
const { areFriends } = require('../models/profiles');
const { getIO } = require('../sockets/ioState');
const { clearPlaybackState, broadcastRoomMembers } = require('../sockets/playback');

const router = express.Router();

router.post('/events', authenticateToken, async (req, res) => {
    try {
        const { name, isPrivate, isLocationRestricted, locationLat, locationLng, locationRadiusM, voteWindowStart, voteWindowEnd } = req.body;
        if (!name) return res.status(400).json({ error: "Event name required" });

        if (isLocationRestricted) {
            if (locationLat == null || locationLng == null) {
                return res.status(400).json({ error: "Event location is required when proximity license is enabled" });
            }
            if (!voteWindowStart || !voteWindowEnd) {
                return res.status(400).json({ error: "Vote time window is required when proximity license is enabled" });
            }
        }

        const result = await db.query(
            `INSERT INTO events (name, is_private, location_restricted, location_lat, location_lng, location_radius_m, vote_window_start, vote_window_end, owner_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [
                name,
                isPrivate,
                isLocationRestricted,
                isLocationRestricted ? locationLat : null,
                isLocationRestricted ? locationLng : null,
                isLocationRestricted ? (locationRadiusM || 100) : null,
                isLocationRestricted ? voteWindowStart : null,
                isLocationRestricted ? voteWindowEnd : null,
                req.user.userId
            ]
        );

        res.status(201).json({ message: "Room created successfully", event: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

router.get('/events', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT DISTINCT e.* FROM events e
             LEFT JOIN event_invitations ei ON ei.event_id = e.id AND ei.user_id = $1 AND ei.status = 'accepted'
             WHERE e.is_private = false OR e.owner_id = $1 OR ei.user_id = $1
             ORDER BY e.created_at DESC`,
            [req.user.userId]
        );
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

router.get('/events/:id', authenticateToken, async (req, res) => {
    try {
        const event = await canAccessEvent(req.user.userId, req.params.id);
        if (!event) return res.status(404).json({ error: "Event not found" });

        let hasControl = event.owner_id === req.user.userId;
        if (!hasControl) {
            const delegation = await db.query(
                'SELECT id FROM event_delegations WHERE event_id = $1 AND user_id = $2',
                [req.params.id, req.user.userId]
            );
            hasControl = delegation.rows.length > 0;
        }

        res.status(200).json({ ...event, hasControl });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

router.delete('/events/:id', authenticateToken, async (req, res) => {
    try {
        const eventId = req.params.id;
        const result = await db.query('SELECT owner_id FROM events WHERE id = $1', [eventId]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Event not found" });
        if (result.rows[0].owner_id !== req.user.userId) {
            return res.status(403).json({ error: "Only the event owner can delete this room" });
        }

        clearPlaybackState(eventId);

        await db.query('DELETE FROM events WHERE id = $1', [eventId]);

        const io = getIO();
        io.to(String(eventId)).emit('room_closed');
        const socketsInRoom = await io.in(String(eventId)).fetchSockets();
        socketsInRoom.forEach(s => s.leave(String(eventId)));

        res.status(200).json({ message: "Room deleted" });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

router.post('/events/:id/invite', authenticateToken, async (req, res) => {
    try {
        const { username } = req.body;
        const eventId = req.params.id;

        const eventResult = await db.query('SELECT * FROM events WHERE id = $1', [eventId]);
        if (eventResult.rows.length === 0) return res.status(404).json({ error: "Event not found" });
        const event = eventResult.rows[0];

        if (event.owner_id !== req.user.userId) {
            return res.status(403).json({ error: "Only the event owner can invite people" });
        }

        const targetResult = await db.query('SELECT id FROM users WHERE username = $1', [username]);
        if (targetResult.rows.length === 0) return res.status(404).json({ error: "User not found" });
        const targetId = targetResult.rows[0].id;

        const friendship = await db.query(
            `SELECT id FROM friendships WHERE status = 'accepted' AND
             ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))`,
            [req.user.userId, targetId]
        );
        if (friendship.rows.length === 0) {
            return res.status(403).json({ error: "You can only invite friends" });
        }

        await db.query(
            `INSERT INTO event_invitations (event_id, user_id, invited_by, status) VALUES ($1, $2, $3, 'pending')
             ON CONFLICT (event_id, user_id) DO UPDATE SET status = 'pending', invited_by = $3
             WHERE event_invitations.status != 'accepted'`,
            [eventId, targetId, req.user.userId]
        );

        res.status(201).json({ message: "Invitation sent" });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

router.get('/events/:id/delegations', authenticateToken, async (req, res) => {
    try {
        const event = await canAccessEvent(req.user.userId, req.params.id);
        if (!event) return res.status(404).json({ error: "Event not found" });

        const result = await db.query(
            `SELECT u.id, u.username FROM event_delegations ed
             JOIN users u ON u.id = ed.user_id
             WHERE ed.event_id = $1`,
            [req.params.id]
        );
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

router.post('/events/:id/delegations', authenticateToken, async (req, res) => {
    try {
        const { username } = req.body;
        const eventId = req.params.id;

        const eventResult = await db.query('SELECT * FROM events WHERE id = $1', [eventId]);
        if (eventResult.rows.length === 0) return res.status(404).json({ error: "Event not found" });
        if (eventResult.rows[0].owner_id !== req.user.userId) {
            return res.status(403).json({ error: "Only the event owner can grant control" });
        }

        const targetResult = await db.query('SELECT id FROM users WHERE username = $1', [username]);
        if (targetResult.rows.length === 0) return res.status(404).json({ error: "User not found" });
        const targetId = targetResult.rows[0].id;

        if (targetId === req.user.userId) {
            return res.status(400).json({ error: "You already control this room" });
        }

        const isFriend = await areFriends(req.user.userId, targetId);
        if (!isFriend) {
            return res.status(403).json({ error: "You can only delegate control to friends" });
        }

        const io = getIO();
        const sockets = await io.in(String(eventId)).fetchSockets();
        const targetSocket = sockets.find(s => s.data.userId === targetId);
        if (!targetSocket || !targetSocket.data.deviceRowId) {
            return res.status(400).json({ error: "This friend must be in the room to receive control" });
        }

        await db.query(
            `INSERT INTO event_delegations (event_id, user_id, device_id, granted_by) VALUES ($1, $2, $3, $4)
             ON CONFLICT (event_id, user_id) DO UPDATE SET device_id = $3, granted_by = $4`,
            [eventId, targetId, targetSocket.data.deviceRowId, req.user.userId]
        );

        await broadcastRoomMembers(eventId);
        res.status(201).json({ message: "Control granted" });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

router.delete('/events/:id/delegations/:userId', authenticateToken, async (req, res) => {
    try {
        const eventId = req.params.id;
        const eventResult = await db.query('SELECT owner_id FROM events WHERE id = $1', [eventId]);
        if (eventResult.rows.length === 0) return res.status(404).json({ error: "Event not found" });
        if (eventResult.rows[0].owner_id !== req.user.userId) {
            return res.status(403).json({ error: "Only the event owner can revoke control" });
        }

        await db.query(
            'DELETE FROM event_delegations WHERE event_id = $1 AND user_id = $2',
            [eventId, req.params.userId]
        );

        await broadcastRoomMembers(eventId);
        res.status(200).json({ message: "Control revoked" });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;