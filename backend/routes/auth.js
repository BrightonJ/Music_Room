const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { loginLimiter, registerLimiter, emailLimiters, resetLimiter } = require('../utils/rateLimiters');
const {
  emailRegex,
  passwordRegex,
  passwordRequirementMessage,
  usernameRegex,
  isValidBirthDate,
  normalizeEmail,
  parseIdentifier,
  cleanString,
} = require('../utils/validators');
const { ClientError } = require('../utils/errors');
const { sendPage } = require('../utils/html');
const { readDeviceInfo, openSession, closeSession, closeAllSessions } = require('../services/session');
const { sendVerificationEmail, sendResetEmail } = require('../services/mailer');
const { disconnectDevice, disconnectUser } = require('../sockets/ioState');

const router = express.Router();

const BCRYPT_ROUNDS = 10;
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
const TOKEN_FORMAT = /^[a-f0-9]{64}$/;
// Compared against when the email is unknown, so that the response time does
// not reveal whether an account exists
const DUMMY_HASH = bcrypt.hashSync('timing-attack-protection', BCRYPT_ROUNDS);

// Finds a user by email or username (case-insensitive). Column names come from
// parseIdentifier, never from the request.
function findByIdentifier(identifier, columns) {
  const where = identifier.column === 'email' ? 'email = $1' : 'LOWER(username) = $1';
  return db.query(`SELECT ${columns} FROM users WHERE ${where} LIMIT 1`, [identifier.value]);
}

const hashToken = (raw) => crypto.createHash('sha256').update(String(raw)).digest('hex');
function newToken() {
  const raw = crypto.randomBytes(32).toString('hex');
  return { raw, hash: hashToken(raw) };
}

// Emails are sent in the background: the answer time is the same whether the
// account exists or not, and an SMTP hiccup never breaks the request.
function sendInBackground(send) {
  Promise.resolve()
    .then(send)
    .catch((err) => console.error('Email sending failed:', err.message));
}

router.post('/register', registerLimiter, async (req, res) => {
  const body = req.body || {};
  const email = normalizeEmail(body.email);
  const firstName = cleanString(body.firstName, 100);
  const lastName = cleanString(body.lastName, 100);
  const { password, username, birthDate } = body;

  if (!email || !password || !username || !firstName || !lastName) {
    throw new ClientError('All required fields must be filled in');
  }
  if (!emailRegex.test(email) || email.length > 255) throw new ClientError('Invalid email format');
  if (typeof username !== 'string' || !usernameRegex.test(username)) {
    throw new ClientError('Username must be 3-20 characters: letters, digits, underscore');
  }
  if (typeof password !== 'string' || !passwordRegex.test(password)) throw new ClientError(passwordRequirementMessage);
  if (birthDate != null && birthDate !== '' && !isValidBirthDate(birthDate)) throw new ClientError('Invalid date of birth');

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const verification = newToken();
  try {
    await db.query(
      `INSERT INTO users (email, password, username, first_name, last_name, birth_date,
                          verification_token_hash, verification_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [email, hashedPassword, username, firstName, lastName, birthDate || null, verification.hash, new Date(Date.now() + VERIFY_TTL_MS)]
    );
  } catch (err) {
    if (err.code === '23505') {
      if (String(err.constraint).includes('username')) throw new ClientError('Username already taken', 409);
      throw new ClientError('Email already in use', 409);
    }
    throw err;
  }

  sendInBackground(() => sendVerificationEmail(email, verification.raw));
  res.status(201).json({ message: 'Account created! Check your emails to activate it.' });
});

router.get('/verify/:token', async (req, res) => {
  const { token } = req.params;
  let activated = false;
  if (TOKEN_FORMAT.test(token)) {
    const result = await db.query(
      `UPDATE users SET is_verified = true, verification_token_hash = NULL, verification_expires_at = NULL
       WHERE verification_token_hash = $1 AND verification_expires_at > NOW()
       RETURNING id`,
      [hashToken(token)]
    );
    activated = result.rows.length > 0;
  }
  if (activated) {
    sendPage(res, 200, { title: 'Account activated', message: 'You can now log in to the Music Room app.' });
  } else {
    sendPage(res, 400, {
      title: 'Link invalid or expired',
      message: 'This activation link is invalid, already used or expired. Ask for a new one from the login screen of the app.',
    });
  }
});

router.post('/resend-verification', ...emailLimiters, async (req, res) => {
  const identifier = parseIdentifier(req.body && (req.body.identifier ?? req.body.email));
  const found = identifier ? await findByIdentifier(identifier, 'email') : { rows: [] };
  const email = found.rows[0] ? found.rows[0].email : '';
  if (emailRegex.test(email)) {
    const verification = newToken();
    const result = await db.query(
      `UPDATE users SET verification_token_hash = $1, verification_expires_at = $2
       WHERE email = $3 AND is_verified = false RETURNING id`,
      [verification.hash, new Date(Date.now() + VERIFY_TTL_MS), email]
    );
    if (result.rows.length > 0) sendInBackground(() => sendVerificationEmail(email, verification.raw));
  }
  res.json({ message: 'If this account exists and is not activated yet, a new activation email has been sent.' });
});

router.post('/login', loginLimiter, async (req, res) => {
  const body = req.body || {};
  // `identifier` is an email or a username; `email` is still accepted for older clients
  const identifier = parseIdentifier(body.identifier ?? body.email);
  const device = readDeviceInfo(req.headers);
  if (!device) throw new ClientError('Missing or invalid X-Device-Id header');
  // Same answer for every failure: it never tells whether an account exists
  if (!identifier || typeof body.password !== 'string' || !body.password) throw new ClientError('Invalid credentials', 401);

  const result = await findByIdentifier(identifier, 'id, email, username, password, is_verified');
  const user = result.rows[0];
  const passwordOk = await bcrypt.compare(body.password.slice(0, 128), (user && user.password) || DUMMY_HASH);
  if (!user || !user.password || !passwordOk) throw new ClientError('Invalid credentials', 401);
  if (!user.is_verified) {
    throw new ClientError('Please activate your account with the link sent by email.', 403, 'EMAIL_NOT_VERIFIED');
  }

  const session = await openSession(user.id, device);
  req.user = { userId: user.id, deviceRowId: session.deviceId }; // for the activity log
  res.json({
    message: 'Login successful',
    token: session.token,
    deviceId: session.deviceId,
    user: { id: user.id, email: user.email, username: user.username },
  });
});

router.post('/logout', requireAuth, async (req, res) => {
  await closeSession(req.user.deviceRowId);
  await disconnectDevice(req.user.deviceRowId);
  res.json({ message: 'Logged out' });
});

router.post('/forgot-password', ...emailLimiters, async (req, res) => {
  const email = normalizeEmail(req.body && req.body.email);
  if (emailRegex.test(email)) {
    const reset = newToken();
    const result = await db.query(
      'UPDATE users SET reset_token_hash = $1, reset_expires_at = $2 WHERE email = $3 RETURNING id',
      [reset.hash, new Date(Date.now() + RESET_TTL_MS), email]
    );
    if (result.rows.length > 0) sendInBackground(() => sendResetEmail(email, reset.raw));
  }
  res.json({ message: 'If this account is registered, you will receive an email to reset your password.' });
});

const RESET_SCRIPT = `
var button = document.getElementById('submit');
var message = document.getElementById('message');
button.addEventListener('click', async function () {
  var newPassword = document.getElementById('newPassword').value;
  var confirmPassword = document.getElementById('confirmPassword').value;
  if (newPassword !== confirmPassword) { message.textContent = 'Passwords do not match'; return; }
  button.disabled = true;
  try {
    var response = await fetch(window.location.pathname, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Platform': 'web-reset-page' },
      body: JSON.stringify({ newPassword: newPassword })
    });
    var data = await response.json();
    message.textContent = response.ok ? data.message : (data.error || 'Something went wrong');
  } catch (err) {
    message.textContent = 'Unable to reach the server';
  }
  button.disabled = false;
});`;

router.get('/reset-password/:token', (req, res) => {
  sendPage(res, 200, {
    title: 'Reset your password',
    message: 'At least 8 characters, with an uppercase letter, a lowercase letter, a digit and a special character.',
    body: `<label for="newPassword">New password</label>
<input id="newPassword" type="password" autocomplete="new-password" />
<label for="confirmPassword">Confirm password</label>
<input id="confirmPassword" type="password" autocomplete="new-password" />
<button id="submit" type="button">Update password</button>
<p class="msg" id="message" role="status"></p>`,
    script: RESET_SCRIPT,
  });
});

router.post('/reset-password/:token', resetLimiter, async (req, res) => {
  const { token } = req.params;
  const newPassword = req.body && req.body.newPassword;
  if (typeof newPassword !== 'string' || !passwordRegex.test(newPassword)) throw new ClientError(passwordRequirementMessage);
  if (!TOKEN_FORMAT.test(token)) throw new ClientError('Invalid or expired link');

  const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  // Single statement: the link can only be used once, even with concurrent clicks.
  // Receiving the email proves ownership of the address, so it also activates the account.
  const result = await db.query(
    `UPDATE users SET password = $1, reset_token_hash = NULL, reset_expires_at = NULL, is_verified = true
     WHERE reset_token_hash = $2 AND reset_expires_at > NOW()
     RETURNING id`,
    [hashedPassword, hashToken(token)]
  );
  if (result.rows.length === 0) throw new ClientError('Invalid or expired link');

  // A password change logs every device out (in case the account was stolen)
  const userId = result.rows[0].id;
  await closeAllSessions(userId);
  await disconnectUser(userId);
  res.json({ message: 'Password updated. Log in again in the app.' });
});

module.exports = router;
