const express = require('express');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { getIO } = require('../sockets/ioState');

const router = express.Router();

router.get('/devices', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, device_uid, platform, device_name, last_seen_at, created_at FROM devices WHERE user_id = $1 ORDER BY last_seen_at DESC`,
            [req.user.userId]
        );
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

router.delete('/devices/:id', authenticateToken, async (req, res) => {
    try {
        const deviceId = Number(req.params.id);
        const result = await db.query(
            'DELETE FROM devices WHERE id = $1 AND user_id = $2 RETURNING id',
            [deviceId, req.user.userId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: "Device not found" });

        const io = getIO();
        if (io) {
            const sockets = await io.fetchSockets();
            const targetSockets = sockets.filter(s => s.data.userId === req.user.userId && s.data.deviceRowId === deviceId);
            targetSockets.forEach(s => s.disconnect(true));
        }

        res.status(200).json({ message: "Device removed" });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;