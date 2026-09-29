const express = require('express');
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { ClientError } = require('../utils/errors');
const { isValidBirthDate, privacyLevels, editableProfileFields, cleanString, usernameRegex } = require('../utils/validators');
const { areFriends, filterProfileForViewer } = require('../models/profiles');

const router = express.Router();

const PROFILE_COLUMNS = `id, username, email, first_name, last_name, birth_date, privacy_settings, music_preferences, profile_completed,
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

// "Complete your profile" (accounts created with Google sign-in): the user
// chooses a username and gives the fields Google did not share.
router.post('/profile/complete', requireAuth, async (req, res) => {
  const body = req.body || {};
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  if (!usernameRegex.test(username)) throw new ClientError('Username: 3-20 characters, letters, digits or underscore');
  const firstName = cleanString(body.firstName, 100);
  const lastName = cleanString(body.lastName, 100);
  if (!firstName) throw new ClientError('First name must be 1 to 100 characters');
  if (!lastName) throw new ClientError('Last name must be 1 to 100 characters');
  if (!isValidBirthDate(body.birthDate)) throw new ClientError('Invalid date of birth');

  const taken = await db.query('SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) AND id <> $2', [username, req.user.userId]);
  if (taken.rows.length > 0) throw new ClientError('Username already taken', 409);

  try {
    const result = await db.query(
      `UPDATE users SET username = $1, first_name = $2, last_name = $3, birth_date = $4, profile_completed = true
       WHERE id = $5 RETURNING ${PROFILE_COLUMNS}`,
      [username, firstName, lastName, body.birthDate, req.user.userId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') throw new ClientError('Username already taken', 409);
    throw err;
  }
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
