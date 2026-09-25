const express = require('express');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/invitations', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT ei.id, ei.event_id, e.name AS event_name, u.username AS invited_by_username
             FROM event_invitations ei
             JOIN events e ON e.id = ei.event_id
             JOIN users u ON u.id = ei.invited_by
             WHERE ei.user_id = $1 AND ei.status = 'pending'
             ORDER BY ei.created_at DESC`,
            [req.user.userId]
        );
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

router.post('/invitations/:id/accept', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            `UPDATE event_invitations SET status = 'accepted' WHERE id = $1 AND user_id = $2 AND status = 'pending' RETURNING *`,
            [req.params.id, req.user.userId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: "Invitation not found" });
        res.status(200).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

router.post('/invitations/:id/decline', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            `DELETE FROM event_invitations WHERE id = $1 AND user_id = $2 AND status = 'pending' RETURNING id`,
            [req.params.id, req.user.userId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: "Invitation not found" });
        res.status(200).json({ message: "Invitation declined" });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;