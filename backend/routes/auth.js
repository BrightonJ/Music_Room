const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/db');
const { JWT_SECRET } = require('../middleware/auth');
const { authLimiter } = require('../utils/rateLimiters');
const {
    emailRegex,
    passwordRegex,
    passwordRequirementMessage,
    usernameRegex,
    isValidBirthDate,
} = require('../utils/validators');

const router = express.Router();
const PORT = process.env.PORT || 3000;

router.post('/register', authLimiter, async (req, res) => {
    try {
        const { email, password, username, firstName, lastName, birthDate } = req.body;

        if (!email || !password || !username || !firstName || !lastName) {
            return res.status(400).json({ error: "All required fields must be filled in" });
        }

        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: "Invalid email format" });
        }

        if (!usernameRegex.test(username)) {
            return res.status(400).json({ error: "Username must be 3-20 characters: letters, digits, underscore" });
        }

        if (!passwordRegex.test(password)) {
            return res.status(400).json({ error: passwordRequirementMessage });
        }

        if (birthDate && !isValidBirthDate(birthDate)) {
            return res.status(400).json({ error: "Invalid date of birth" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationToken = crypto.randomBytes(32).toString('hex');

        await db.query(
            `INSERT INTO users (email, password, username, first_name, last_name, birth_date, verification_token) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, email`,
            [email, hashedPassword, username, firstName, lastName, birthDate || null, verificationToken]
        );

        const verifyLink = `http://localhost:${PORT}/api/verify/${verificationToken}`;
        console.log(`\n[SIMULATED EMAIL for ${email}]`);
        console.log(`Subject: Welcome to Music Room! Confirm your email`);
        console.log(`Click this link to activate your account : ${verifyLink}\n`);

        res.status(201).json({ message: "Account created! Please check your emails to activate it." });
    } catch (err) {
        if (err.code === '23505') {
            if (err.constraint && err.constraint.includes('username')) {
                return res.status(409).json({ error: "Username already taken" });
            }
            return res.status(409).json({ error: "Email already in use" });
        }
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

router.get('/verify/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const result = await db.query(
            'UPDATE users SET is_verified = true, verification_token = NULL WHERE verification_token = $1 RETURNING id',
            [token]
        );

        if (result.rowCount === 0) {
            return res.status(400).send("<h1>Invalid link or account already verified.</h1>");
        }

        res.status(200).send("<h1>Account activated successfully! You can now log in to the app.</h1>");
    } catch (err) {
        res.status(500).send("<h1>Server error</h1>");
    }
});

router.post('/login', authLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const result = await db.query('SELECT * FROM users WHERE email = $1 AND auth_provider = $2', [email, 'local']);
        const user = result.rows[0];

        if (!user || !user.password) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return res.status(401).json({ error: "Invalid credentials" });

        if (!user.is_verified) {
            return res.status(403).json({ error: "Please click the link sent by email to activate your account." });
        }

        const token = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(200).json({ message: "Login successful", token, user: { id: user.id, email: user.email } });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

router.post('/forgot-password', authLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (user) {
            const rawToken = crypto.randomBytes(32).toString('hex');
            const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
            const expires = new Date(Date.now() + 60 * 60 * 1000);

            await db.query(
                'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
                [hashedToken, expires, user.id]
            );

            const resetLink = `http://localhost:${PORT}/api/reset-password/${rawToken}`;
            console.log(`\n[SIMULATED EMAIL for ${email}]`);
            console.log(`Subject: Reset your Music Room password`);
            console.log(`Click this link to create a new password: ${resetLink}\n`);
        }

        res.status(200).json({ message: "If this account is registered, you will receive an email to reset your password." });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

router.get('/reset-password/:token', (req, res) => {
    res.removeHeader('Content-Security-Policy');
    res.status(200).send(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reset your password</title>
<style>
body { font-family: sans-serif; background:#121212; color:#fff; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }
.card { background:#282828; padding:32px; border-radius:12px; width:320px; box-sizing:border-box; }
h2 { margin-top:0; }
input { width:100%; padding:12px; margin-top:8px; margin-bottom:16px; border-radius:8px; border:none; box-sizing:border-box; font-size:15px; }
button { width:100%; padding:14px; border:none; border-radius:24px; background:#1DB954; color:#121212; font-weight:bold; font-size:16px; }
p.msg { font-weight:bold; }
p.hint { color:#B3B3B3; font-size:12px; }
</style>
</head>
<body>
<div class="card">
<h2>Reset your password</h2>
<p class="hint">At least 8 characters, with an uppercase letter, a lowercase letter, a digit and a special character.</p>
<input id="newPassword" type="password" placeholder="New password" />
<input id="confirmPassword" type="password" placeholder="Confirm password" />
<button onclick="submitReset()">Update password</button>
<p class="msg" id="message"></p>
</div>
<script>
async function submitReset() {
  var newPassword = document.getElementById('newPassword').value;
  var confirmPassword = document.getElementById('confirmPassword').value;
  var messageEl = document.getElementById('message');
  if (newPassword !== confirmPassword) {
    messageEl.textContent = "Passwords do not match";
    return;
  }
  try {
    var response = await fetch(window.location.pathname, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: newPassword })
    });
    var data = await response.json();
    messageEl.textContent = response.ok ? "Password updated. You can close this page." : (data.error || "Something went wrong");
  } catch (err) {
    messageEl.textContent = "Unable to reach the server";
  }
}
</script>
</body>
</html>`);
});

router.post('/reset-password/:token', authLimiter, async (req, res) => {
    try {
        const { token } = req.params;
        const { newPassword } = req.body;

        if (!newPassword || !passwordRegex.test(newPassword)) {
            return res.status(400).json({ error: passwordRequirementMessage });
        }

        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        const result = await db.query(
            'SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
            [hashedToken]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: "Invalid or expired link" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.query(
            'UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
            [hashedPassword, result.rows[0].id]
        );

        res.status(200).json({ message: "Password updated successfully" });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;