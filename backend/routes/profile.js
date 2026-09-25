const express = require('express');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { isValidBirthDate, privacyLevels, editableProfileFields } = require('../utils/validators');
const { areFriends, filterProfileForViewer } = require('../models/profiles');

const router = express.Router();

router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, username, email, first_name, last_name, birth_date, privacy_settings, music_preferences FROM users WHERE id = $1',
            [req.user.userId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });
        res.status(200).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const { firstName, lastName, birthDate, privacySettings, musicPreferences } = req.body;

        if (birthDate && !isValidBirthDate(birthDate)) {
            return res.status(400).json({ error: "Invalid date of birth" });
        }

        if (privacySettings) {
            for (const [field, level] of Object.entries(privacySettings)) {
                if (!editableProfileFields.includes(field)) {
                    return res.status(400).json({ error: `Unknown field: ${field}` });
                }
                if (!privacyLevels.includes(level)) {
                    return res.status(400).json({ error: `Invalid privacy level for ${field}` });
                }
            }
        }

        if (musicPreferences && (!Array.isArray(musicPreferences) || musicPreferences.some(p => typeof p !== 'string' || p.length > 50))) {
            return res.status(400).json({ error: "Invalid music preferences format" });
        }

        const current = await db.query('SELECT privacy_settings FROM users WHERE id = $1', [req.user.userId]);
        const mergedSettings = { ...current.rows[0].privacy_settings, ...(privacySettings || {}) };

        const result = await db.query(
            `UPDATE users SET
                first_name = COALESCE($1, first_name),
                last_name = COALESCE($2, last_name),
                birth_date = COALESCE($3, birth_date),
                privacy_settings = $4,
                music_preferences = COALESCE($5, music_preferences)
             WHERE id = $6
             RETURNING id, username, email, first_name, last_name, birth_date, privacy_settings, music_preferences`,
            [
                firstName || null,
                lastName || null,
                birthDate || null,
                mergedSettings,
                musicPreferences ? JSON.stringify(musicPreferences) : null,
                req.user.userId
            ]
        );

        res.status(200).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

router.get('/users/:username/profile', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, username, first_name, last_name, birth_date, privacy_settings, music_preferences FROM users WHERE username = $1',
            [req.params.username]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });

        const user = result.rows[0];
        const isSelf = user.id === req.user.userId;
        const isFriend = isSelf ? false : await areFriends(req.user.userId, user.id);

        const profile = filterProfileForViewer(user, isSelf, isFriend);
        res.status(200).json({ ...profile, isSelf, isFriend });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;