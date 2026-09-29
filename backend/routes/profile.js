const express = require('express');
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { ClientError } = require('../utils/errors');
const { isValidBirthDate, privacyLevels, editableProfileFields, cleanString, usernameRegex } = require('../utils/validators');
const { areFriends, filterProfileForViewer } = require('../models/profiles');

const router = express.Router();

const PROFILE_COLUMNS = `id, username, email, first_name, last_name, birth_date, privacy_settings, music_preferences,
  (password IS NOT NULL) AS has_password, (google_id IS NOT NULL) AS google_linked`;

router.get('/profile', requireAuth, async (req, res) => {
  const result = await db.query(`SELECT ${PROFILE_COLUMNS} FROM users WHERE id = $1`, [req.user.userId]);
  if (result.rows.length === 0) throw new ClientError('User not found', 404);
  res.json(result.rows[0]);
});

// Partial update: only the fields present in the body are changed
router.put('/profile', requireAuth, async (req, res) => {
  const body = req.body || {};
  const sets = [];
  const values = [];
  const set = (column, value, cast = '') => {
    values.push(value);
    sets.push(`${column} = $${values.length}${cast}`);
  };

  if (body.firstName !== undefined) {
    const firstName = cleanString(body.firstName, 100);
    if (!firstName) throw new ClientError('First name must be 1 to 100 characters');
    set('first_name', firstName);
  }
  if (body.lastName !== undefined) {
    const lastName = cleanString(body.lastName, 100);
    if (!lastName) throw new ClientError('Last name must be 1 to 100 characters');
    set('last_name', lastName);
  }
  if (body.birthDate !== undefined) {
    if (body.birthDate === null || body.birthDate === '') set('birth_date', null);
    else if (!isValidBirthDate(body.birthDate)) throw new ClientError('Invalid date of birth');
    else set('birth_date', body.birthDate);
  }
  if (body.musicPreferences !== undefined) {
    const prefs = body.musicPreferences;
    if (!Array.isArray(prefs) || prefs.length > 30) throw new ClientError('Music preferences must be a list of at most 30 items');
    const cleaned = [];
    for (const item of prefs) {
      const value = cleanString(item, 50);
      if (!value) throw new ClientError('Each music preference must be 1 to 50 characters');
      if (!cleaned.some((p) => p.toLowerCase() === value.toLowerCase())) cleaned.push(value);
    }
    set('music_preferences', JSON.stringify(cleaned), '::jsonb');
  }
  if (body.privacySettings !== undefined) {
    const settings = body.privacySettings;
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new ClientError('Invalid privacy settings');
    for (const [field, level] of Object.entries(settings)) {
      if (!editableProfileFields.includes(field)) throw new ClientError(`Unknown field: ${field}`);
      if (!privacyLevels.includes(level)) throw new ClientError(`Invalid privacy level for ${field}`);
    }
    // Merged by PostgreSQL itself: no read-modify-write race
    values.push(JSON.stringify(settings));
    sets.push(`privacy_settings = privacy_settings || $${values.length}::jsonb`);
  }
  if (sets.length === 0) throw new ClientError('Nothing to update');

  values.push(req.user.userId);
  const result = await db.query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING ${PROFILE_COLUMNS}`,
    values
  );
  res.json(result.rows[0]);
});

router.get('/users/:username/profile', requireAuth, async (req, res) => {
  const { username } = req.params;
  if (!usernameRegex.test(username)) throw new ClientError('User not found', 404);
  const result = await db.query(
    'SELECT id, username, first_name, last_name, birth_date, privacy_settings, music_preferences FROM users WHERE username = $1',
    [username]
  );
  if (result.rows.length === 0) throw new ClientError('User not found', 404);
  const user = result.rows[0];
  const isSelf = user.id === req.user.userId;
  const isFriend = isSelf ? false : await areFriends(req.user.userId, user.id);
  res.json({ ...filterProfileForViewer(user, isSelf, isFriend), isSelf, isFriend });
});

module.exports = router;
