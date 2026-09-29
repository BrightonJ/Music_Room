const express = require('express');
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { loginLimiter } = require('../utils/rateLimiters');
const { ClientError } = require('../utils/errors');
const { readDeviceInfo, openSession } = require('../services/session');
const { verifyGoogleToken } = require('../services/social');

const router = express.Router();

// Only Google sign-in is supported (the subject asks for Google OR Facebook).
// Google id_token → unified profile shape
async function verifyToken(provider, token) {
  if (provider === 'google') return verifyGoogleToken(token);
  throw new ClientError('Unsupported provider', 400);
}

// Build a unique username from the email local-part + a random suffix
async function generateUsername(email, firstName) {
  const base = (email ? email.split('@')[0] : firstName || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 14) || 'user';
  for (let i = 0; i < 5; i += 1) {
    const suffix = Math.floor(Math.random() * 9000 + 1000);
    const candidate = `${base}${suffix}`.slice(0, 20);
    const existing = await db.query('SELECT 1 FROM users WHERE LOWER(username) = LOWER($1)', [candidate]);
    if (existing.rows.length === 0) return candidate;
  }
  // Extremely unlikely fallback
  return `user${Date.now().toString().slice(-10)}`.slice(0, 20);
}

// Only an email the provider has verified can be trusted: it is used to find
// (and link) an existing account, so an unverified one could hijack it.
const trustedEmail = (profile) => (profile.email && profile.emailVerified ? profile.email.trim().toLowerCase() : null);

// Create a brand new user from a social profile (no password). The username is
// generated and the date of birth is unknown: the profile stays "incomplete"
// until the user fills the "complete your profile" screen.
async function createSocialUser(provider, profile) {
  const column = 'google_id';
  const email = trustedEmail(profile) || `${provider}_${profile.providerId}@social.musicroom.local`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const username = await generateUsername(email, profile.firstName);
    try {
      const result = await db.query(
        `INSERT INTO users (email, username, first_name, last_name, ${column}, is_verified, profile_completed)
         VALUES ($1, $2, $3, $4, $5, true, false)
         RETURNING id, email, username, profile_completed`,
        [email, username, profile.firstName, profile.lastName, profile.providerId]
      );
      return result.rows[0];
    } catch (err) {
      // Two sign-ups picked the same generated username at the same time: try another one
      if (err.code === '23505' && String(err.constraint).includes('username')) continue;
      throw err;
    }
  }
  throw new Error('Could not generate a unique username');
}

// Find the user matching the social profile: by provider id first, then by email
async function findUser(provider, profile) {
  const column = 'google_id';
  const byProvider = await db.query(
    `SELECT id, email, username, profile_completed, ${column} AS provider_id FROM users WHERE ${column} = $1`,
    [profile.providerId]
  );
  if (byProvider.rows.length > 0) return { user: byProvider.rows[0], linked: true };

  const email = trustedEmail(profile);
  if (email) {
    const byEmail = await db.query(
      `SELECT id, email, username, profile_completed, ${column} AS provider_id FROM users WHERE email = $1`,
      [email]
    );
    if (byEmail.rows.length > 0) return { user: byEmail.rows[0], linked: false };
  }
  return { user: null, linked: false };
}

// Link the provider id to an existing account (same email, first time)
async function linkProvider(userId, provider, providerId) {
  const column = 'google_id';
  await db.query(`UPDATE users SET ${column} = $1 WHERE id = $2`, [providerId, userId]);
}

// ---------------------------------------------------------------------------
// POST /api/auth/google    { idToken }
// Login OR signup in a single call. On first login, auto-link by email.
// ---------------------------------------------------------------------------
async function socialLogin(provider, token, req, res) {
  const device = readDeviceInfo(req.headers);
  if (!device) throw new ClientError('Missing or invalid X-Device-Id header');

  const profile = await verifyToken(provider, token);
  const { user, linked } = await findUser(provider, profile);

  let finalUser = user;
  if (!finalUser) {
    finalUser = await createSocialUser(provider, profile);
  } else if (!linked) {
    // Same VERIFIED email, account created the classic way → link silently
    await linkProvider(finalUser.id, provider, profile.providerId);
  }

  const session = await openSession(finalUser.id, device);
  req.user = { userId: finalUser.id, deviceRowId: session.deviceId };
  res.json({
    message: 'Login successful',
    token: session.token,
    deviceId: session.deviceId,
    user: { id: finalUser.id, email: finalUser.email, username: finalUser.username },
    // true: the app shows the "complete your profile" screen before the rooms
    profileIncomplete: !finalUser.profile_completed,
  });
}

router.post('/google', loginLimiter, (req, res, next) => {
  const { idToken } = req.body || {};
  if (typeof idToken !== 'string' || !idToken) {
    return next(new ClientError('idToken is required', 400));
  }
  socialLogin('google', idToken, req, res).catch(next);
});


// ---------------------------------------------------------------------------
// POST /api/auth/link/google    { idToken }        (auth required)
// Attach a social account to the currently logged-in user.
// ---------------------------------------------------------------------------
async function socialLink(provider, token, req, res) {
  const profile = await verifyToken(provider, token);
  const column = 'google_id';

  // Prevent linking a provider id already attached to someone else
  const conflict = await db.query(
    `SELECT id FROM users WHERE ${column} = $1 AND id <> $2`,
    [profile.providerId, req.user.userId]
  );
  if (conflict.rows.length > 0) {
    throw new ClientError('This account is already linked to another user', 409);
  }

  await db.query(`UPDATE users SET ${column} = $1 WHERE id = $2`, [profile.providerId, req.user.userId]);
  res.json({ message: `${provider} account linked` });
}

router.post('/link/google', requireAuth, (req, res, next) => {
  const { idToken } = req.body || {};
  if (typeof idToken !== 'string' || !idToken) return next(new ClientError('idToken is required', 400));
  socialLink('google', idToken, req, res).catch(next);
});


module.exports = router;
