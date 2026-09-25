require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./config/db');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is missing. Set it in backend/.env before starting the server.");
    process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET;
const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);

app.use(helmet());
app.use(cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(express.json());

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many attempts, please try again later" }
});

const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false
});

app.use(globalLimiter);

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Authentication required" });
    jwt.verify(token, JWT_SECRET, (err, payload) => {
        if (err) return res.status(403).json({ error: "Invalid or expired token" });
        req.user = payload;
        next();
    });
}

function isValidBirthDate(dateString) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false;
    const [y, m, d] = dateString.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d && date <= new Date();
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const usernameRegex = /^[A-Za-z0-9_]{3,20}$/;
const privacyLevels = ['public', 'friends', 'private'];
const editableProfileFields = ['first_name', 'last_name', 'birth_date', 'music_preferences'];

async function areFriends(userIdA, userIdB) {
    const result = await db.query(
        `SELECT id FROM friendships WHERE status = 'accepted' AND
         ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))`,
        [userIdA, userIdB]
    );
    return result.rows.length > 0;
}

function filterProfileForViewer(user, isSelf, isFriend) {
    const settings = user.privacy_settings || {};
    const visible = { id: user.id, username: user.username };

    const fieldMap = {
        first_name: user.first_name,
        last_name: user.last_name,
        birth_date: user.birth_date,
        music_preferences: user.music_preferences
    };

    for (const field of Object.keys(fieldMap)) {
        const level = settings[field] || 'private';
        const canSee = isSelf || level === 'public' || (level === 'friends' && isFriend);
        if (canSee) visible[field] = fieldMap[field];
    }

    return visible;
}

async function canAccessEvent(userId, eventId) {
    const result = await db.query(
        `SELECT e.* FROM events e
         LEFT JOIN event_invitations ei ON ei.event_id = e.id AND ei.user_id = $2
         WHERE e.id = $1 AND (e.is_private = false OR e.owner_id = $2 OR ei.user_id = $2)`,
        [eventId, userId]
    );
    return result.rows[0] || null;
}

async function getQueueForEvent(eventId) {
    const result = await db.query(
        `SELECT t.id, t.event_id, t.user_id, t.title, t.artist, t.cover_url, t.preview_url, t.duration_ms,
                COALESCE(SUM(tv.value), 0)::int AS votes
         FROM tracks t
         LEFT JOIN track_votes tv ON tv.track_id = t.id
         WHERE t.event_id = $1 AND t.played = false
         GROUP BY t.id
         ORDER BY votes DESC, t.created_at ASC`,
        [eventId]
    );
    return result.rows;
}

async function getPlaybackState(eventId) {
    const result = await db.query(
        `SELECT ep.started_at, ep.duration_ms, t.id, t.title, t.artist, t.cover_url, t.preview_url
         FROM event_playback ep
         JOIN tracks t ON t.id = ep.current_track_id
         WHERE ep.event_id = $1`,
        [eventId]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
        track: { id: row.id, title: row.title, artist: row.artist, coverUrl: row.cover_url, previewUrl: row.preview_url },
        startedAt: row.started_at,
        durationMs: row.duration_ms
    };
}

app.post('/api/register', authLimiter, async (req, res) => {
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
            return res.status(400).json({ error: "Password must be at least 8 characters long and contain at least one letter and one digit" });
        }

        if (birthDate && !isValidBirthDate(birthDate)) {
            return res.status(400).json({ error: "Invalid date of birth" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationToken = crypto.randomBytes(32).toString('hex');

        const result = await db.query(
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

app.get('/api/verify/:token', async (req, res) => {
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

app.post('/api/login', authLimiter, async (req, res) => {
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

app.post('/api/events', authenticateToken, async (req, res) => {
    try {
        const { name, isPrivate, isLocationRestricted } = req.body;
        if (!name) return res.status(400).json({ error: "Event name required" });

        const result = await db.query(
            'INSERT INTO events (name, is_private, location_restricted, owner_id) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, isPrivate, isLocationRestricted, req.user.userId]
        );

        res.status(201).json({ message: "Room created successfully", event: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

app.get('/api/events', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT DISTINCT e.* FROM events e
             LEFT JOIN event_invitations ei ON ei.event_id = e.id AND ei.user_id = $1
             WHERE e.is_private = false OR e.owner_id = $1 OR ei.user_id = $1
             ORDER BY e.created_at DESC`,
            [req.user.userId]
        );
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

app.post('/api/forgot-password', authLimiter, async (req, res) => {
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

        res.status(200).json({ message: "If this email exists, a reset link has been sent." });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

app.post('/api/reset-password/:token', authLimiter, async (req, res) => {
    try {
        const { token } = req.params;
        const { newPassword } = req.body;

        if (!newPassword || !passwordRegex.test(newPassword)) {
            return res.status(400).json({ error: "Password must be at least 8 characters long and contain at least one letter and one digit" });
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

app.get('/api/profile', authenticateToken, async (req, res) => {
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

app.put('/api/profile', authenticateToken, async (req, res) => {
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

app.get('/api/users/:username/profile', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, username, first_name, last_name, birth_date, privacy_settings, music_preferences FROM users WHERE username = $1',
            [req.params.username]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });

        const user = result.rows[0];
        const isSelf = user.id === req.user.userId;
        const isFriend = isSelf ? false : await areFriends(req.user.userId, user.id);

        res.status(200).json(filterProfileForViewer(user, isSelf, isFriend));
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

app.get('/api/users/search', authenticateToken, async (req, res) => {
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

app.post('/api/friends/requests', authenticateToken, async (req, res) => {
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

app.get('/api/friends/requests', authenticateToken, async (req, res) => {
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

app.post('/api/friends/requests/:id/accept', authenticateToken, async (req, res) => {
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

app.post('/api/friends/requests/:id/decline', authenticateToken, async (req, res) => {
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

app.get('/api/friends', authenticateToken, async (req, res) => {
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

app.post('/api/events/:id/invite', authenticateToken, async (req, res) => {
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
            `INSERT INTO event_invitations (event_id, user_id, invited_by) VALUES ($1, $2, $3)
             ON CONFLICT (event_id, user_id) DO NOTHING`,
            [eventId, targetId, req.user.userId]
        );

        res.status(201).json({ message: "Invitation sent" });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

app.get('/api/search/tracks', authenticateToken, async (req, res) => {
    try {
        const q = (req.query.q || '').trim();
        if (q.length < 2) return res.status(200).json([]);

        const deezerResponse = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=10`);
        if (!deezerResponse.ok) {
            return res.status(502).json({ error: "Music search is currently unavailable" });
        }

        const deezerData = await deezerResponse.json();

        const tracks = (deezerData.data || []).map(t => ({
            deezerId: t.id,
            title: t.title,
            artist: t.artist ? t.artist.name : 'Unknown',
            coverUrl: t.album ? t.album.cover_medium : null,
            previewUrl: t.preview || null,
            durationMs: (t.duration || 30) * 1000
        }));

        res.status(200).json(tracks);
    } catch (err) {
        console.error(err);
        res.status(502).json({ error: "Music search is currently unavailable" });
    }
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: allowedOrigins.length ? allowedOrigins : true,
        methods: ["GET", "POST"]
    }
});

const playbackTimers = {};

async function playNext(roomId) {
    if (playbackTimers[roomId]) {
        clearTimeout(playbackTimers[roomId]);
        delete playbackTimers[roomId];
    }

    const current = await db.query('SELECT current_track_id FROM event_playback WHERE event_id = $1', [roomId]);
    if (current.rows.length && current.rows[0].current_track_id) {
        await db.query('UPDATE tracks SET played = true WHERE id = $1', [current.rows[0].current_track_id]);
    }

    const queue = await getQueueForEvent(roomId);

    if (queue.length === 0) {
        await db.query(
            `INSERT INTO event_playback (event_id, current_track_id, started_at, duration_ms) VALUES ($1, NULL, NULL, NULL)
             ON CONFLICT (event_id) DO UPDATE SET current_track_id = NULL, started_at = NULL, duration_ms = NULL`,
            [roomId]
        );
        io.to(String(roomId)).emit('now_playing', null);
        io.to(String(roomId)).emit('update_queue', []);
        return;
    }

    const next = queue[0];
    const durationMs = next.duration_ms || 30000;
    const startedAt = new Date();

    await db.query(
        `INSERT INTO event_playback (event_id, current_track_id, started_at, duration_ms) VALUES ($1, $2, $3, $4)
         ON CONFLICT (event_id) DO UPDATE SET current_track_id = $2, started_at = $3, duration_ms = $4`,
        [roomId, next.id, startedAt, durationMs]
    );

    const remainingQueue = await getQueueForEvent(roomId);

    io.to(String(roomId)).emit('now_playing', {
        track: { id: next.id, title: next.title, artist: next.artist, coverUrl: next.cover_url, previewUrl: next.preview_url },
        startedAt: startedAt.toISOString(),
        durationMs
    });
    io.to(String(roomId)).emit('update_queue', remainingQueue);

    playbackTimers[roomId] = setTimeout(() => {
        playNext(roomId).catch(err => console.error(err));
    }, durationMs);
}

io.use((socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));
    jwt.verify(token, JWT_SECRET, (err, payload) => {
        if (err) return next(new Error('Invalid or expired token'));
        socket.data.userId = payload.userId;
        next();
    });
});

io.on('connection', (socket) => {
    socket.on('join_room', async (roomId) => {
        try {
            const event = await canAccessEvent(socket.data.userId, roomId);
            if (!event) {
                socket.emit('room_error', 'Access denied');
                return;
            }

            socket.join(String(roomId));

            const queue = await getQueueForEvent(roomId);
            socket.emit('update_queue', queue);

            const playback = await getPlaybackState(roomId);
            socket.emit('now_playing', playback);
        } catch (err) { console.error(err); }
    });

    socket.on('add_track', async (trackData) => {
        try {
            const { roomId, title, artist, coverUrl, previewUrl, durationMs } = trackData;
            const event = await canAccessEvent(socket.data.userId, roomId);
            if (!event) {
                socket.emit('room_error', 'Access denied');
                return;
            }

            const existing = await db.query(
                'SELECT id FROM tracks WHERE event_id = $1 AND played = false AND title = $2 AND artist = $3',
                [roomId, title, artist]
            );
            if (existing.rows.length > 0) {
                socket.emit('room_error', 'Track already in the queue');
                return;
            }

            await db.query(
                'INSERT INTO tracks (event_id, user_id, title, artist, cover_url, preview_url, duration_ms) VALUES ($1,$2,$3,$4,$5,$6,$7)',
                [roomId, socket.data.userId, title, artist, coverUrl || null, previewUrl || null, durationMs || 30000]
            );

            const queue = await getQueueForEvent(roomId);
            io.to(String(roomId)).emit('update_queue', queue);

            const playback = await getPlaybackState(roomId);
            if (!playback) {
                await playNext(roomId);
            }
        } catch (err) { console.error(err); }
    });

    socket.on('vote_track', async ({ trackId, roomId, value }) => {
        try {
            const event = await canAccessEvent(socket.data.userId, roomId);
            if (!event) {
                socket.emit('room_error', 'Access denied');
                return;
            }

            if (![1, -1, 0].includes(value)) return;

            if (value === 0) {
                await db.query('DELETE FROM track_votes WHERE track_id = $1 AND user_id = $2', [trackId, socket.data.userId]);
            } else {
                await db.query(
                    `INSERT INTO track_votes (track_id, user_id, value) VALUES ($1, $2, $3)
                     ON CONFLICT (track_id, user_id) DO UPDATE SET value = $3`,
                    [trackId, socket.data.userId, value]
                );
            }

            const queue = await getQueueForEvent(roomId);
            io.to(String(roomId)).emit('update_queue', queue);
        } catch (err) { console.error(err); }
    });

    socket.on('disconnect', () => {});
});

server.listen(PORT, () => {
    console.log(`API + WebSockets on port ${PORT}`);
});