const express = require('express');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/users/search', authenticateToken, async (req, res) => {
    try {
        const q = (req.query.q || '').trim();
        if (q.length < 2) return res.status(200).json([]);

        const result = await db.query(
            `SELECT id, username FROM users WHERE username ILIKE $1 AND id != $2 LIMIT 10`,
            [`%${q}%`, req.user.userId]
        );
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

router.post('/friends/requests', authenticateToken, async (req, res) => {
    try {
        const { username } = req.body;
        if (!username) return res.status(400).json({ error: "Username required" });

        const target = await db.query('SELECT id FROM users WHERE username = $1', [username]);
        if (target.rows.length === 0) return res.status(404).json({ error: "User not found" });

        const addresseeId = target.rows[0].id;
        if (addresseeId === req.user.userId) {
            return res.status(400).json({ error: "You cannot add yourself" });
        }

        const existing = await db.query(
            `SELECT id FROM friendships WHERE
             (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
            [req.user.userId, addresseeId]
        );
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: "Friend request already exists" });
        }

        const result = await db.query(
            `INSERT INTO friendships (requester_id, addressee_id, status) VALUES ($1, $2, 'pending') RETURNING *`,
            [req.user.userId, addresseeId]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

router.get('/friends/requests', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT f.id, f.created_at, u.id AS requester_id, u.username AS requester_username
             FROM friendships f
             JOIN users u ON u.id = f.requester_id
             WHERE f.addressee_id = $1 AND f.status = 'pending'
             ORDER BY f.created_at DESC`,
            [req.user.userId]
        );
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

router.post('/friends/requests/:id/accept', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            `UPDATE friendships SET status = 'accepted' WHERE id = $1 AND addressee_id = $2 AND status = 'pending' RETURNING *`,
            [req.params.id, req.user.userId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: "Request not found" });
        res.status(200).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

router.post('/friends/requests/:id/decline', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            `DELETE FROM friendships WHERE id = $1 AND addressee_id = $2 AND status = 'pending' RETURNING id`,
            [req.params.id, req.user.userId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: "Request not found" });
        res.status(200).json({ message: "Request declined" });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

router.get('/friends', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT u.id, u.username FROM friendships f
             JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
             WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = 'accepted'
             ORDER BY u.username ASC`,
            [req.user.userId]
        );
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;