require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./config/db');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');

const app = express();
const roomsQueue = {};
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post('/api/register', async (req, res) => {
    try {
        const { email, password, firstName, lastName, birthDate } = req.body;
        
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({ error: "All required fields must be filled in" });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationToken = crypto.randomBytes(32).toString('hex'); // Create a unique, secure token
        
        const result = await db.query(
            `INSERT INTO users (email, password, first_name, last_name, birth_date, verification_token) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email`,
            [email, hashedPassword, firstName, lastName, birthDate || null, verificationToken]
        );
        
        // ✉️ SIMULATED EMAIL SENDING (printed in the terminal)
        const verifyLink = `http://localhost:${PORT}/api/verify/${verificationToken}`;
        console.log(`\n📧 [SIMULATED EMAIL for ${email}]`);
        console.log(`Subject: Welcome to Music Room! Confirm your email`);
        console.log(`Click this link to activate your account : ${verifyLink}\n`);

        res.status(201).json({ message: "Account created! Please check your emails to activate it." });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: "Email already in use" });
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

// --- ROUTE 2: LINK VERIFICATION ---
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

        res.status(200).send("<h1>✅ Account activated successfully! You can now log in to the app.</h1>");
    } catch (err) {
        res.status(500).send("<h1>Server error</h1>");
    }
});

// --- ROUTE 3: LOGIN (blocked if not verified) ---
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await db.query('SELECT * FROM users WHERE email = $1 AND auth_provider = $2', [email, 'local']);
        
        if (result.rows.length === 0) return res.status(401).json({ error: "Invalid credentials" });
        
        const user = result.rows[0];

        // 🛑 GATEKEEPER: check that the account is activated
        if (!user.is_verified) {
            return res.status(403).json({ error: "Please click the link sent by email to activate your account." });
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return res.status(401).json({ error: "Invalid credentials" });

        const token = jwt.sign(
            { userId: user.id, email: user.email }, 
            process.env.JWT_SECRET || 'mon_super_secret',
            { expiresIn: '24h' }
        );

        res.status(200).json({ message: "Login successful", token, user: { id: user.id, email: user.email } });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

app.post('/api/events', async (req, res) => {
    try {
        const { name, isPrivate, isLocationRestricted } = req.body;
        if (!name) return res.status(400).json({ error: "Event name required" });

        const result = await db.query(
            'INSERT INTO events (name, is_private, location_restricted) VALUES ($1, $2, $3) RETURNING *',
            [name, isPrivate, isLocationRestricted]
        );
        
        res.status(201).json({ message: "Room created successfully", event: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

app.get('/api/events', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM events ORDER BY created_at DESC');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "No account is associated with this email address." });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetLink = `http://localhost:${PORT}/api/reset-password/${resetToken}`;
        
        console.log(`\n📧 [SIMULATED EMAIL for ${email}]`);
        console.log(`Subject: Reset your Music Room password`);
        console.log(`Click this link to create a new password : ${resetLink}\n`);

        res.status(200).json({ message: "If this email exists, a reset link has been sent." });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log(`📱 Connected: ${socket.id}`);

    // 1. JOIN THE ROOM & LOAD THE PLAYLIST FROM THE DB
    socket.on('join_room', async (roomId) => {
        socket.join(roomId);
        console.log(`👤 Joined room: ${roomId}`);
        try {
            const result = await db.query('SELECT * FROM tracks WHERE event_id = $1 ORDER BY votes DESC, created_at ASC', [roomId]);
            socket.emit('update_queue', result.rows);
        } catch (err) { console.error(err); }
    });

    // 2. ADD A TRACK & BROADCAST
    socket.on('add_track', async (trackData) => {
        const { roomId, title, artist, coverUrl } = trackData;
        const mockUserId = 1; // Temporary: will be linked to the JWT token later
        
        try {
            await db.query(
                'INSERT INTO tracks (event_id, user_id, title, artist, cover_url) VALUES ($1, $2, $3, $4, $5)',
                [roomId, mockUserId, title, artist, coverUrl]
            );
            // Fetch the updated list
            const result = await db.query('SELECT * FROM tracks WHERE event_id = $1 ORDER BY votes DESC, created_at ASC', [roomId]);
            io.to(roomId).emit('update_queue', result.rows); // Broadcast to all phones
        } catch (err) { console.error(err); }
    });

    // 3. VOTING SYSTEM
    socket.on('vote_track', async ({ trackId, roomId, voteValue }) => {
        try {
            await db.query('UPDATE tracks SET votes = votes + $1 WHERE id = $2', [voteValue, trackId]);
            const result = await db.query('SELECT * FROM tracks WHERE event_id = $1 ORDER BY votes DESC, created_at ASC', [roomId]);
            io.to(roomId).emit('update_queue', result.rows);
        } catch (err) { console.error(err); }
    });

    socket.on('disconnect', () => {
        console.log(`📵 Disconnected: ${socket.id}`);
    });
});

server.listen(PORT, () => {
    console.log(`🚀 API + WebSockets on port ${PORT}`);
});