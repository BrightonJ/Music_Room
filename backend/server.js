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
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post('/api/register', async (req, res) => {
    try {
        const { email, password, firstName, lastName, birthDate } = req.body;
        
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({ error: "Tous les champs obligatoires doivent être remplis" });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationToken = crypto.randomBytes(32).toString('hex'); // Crée un token unique sécurisé
        
        const result = await db.query(
            `INSERT INTO users (email, password, first_name, last_name, birth_date, verification_token) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email`,
            [email, hashedPassword, firstName, lastName, birthDate || null, verificationToken]
        );
        
        // ✉️ SIMULATION D'ENVOI D'EMAIL (S'affiche dans le terminal)
        const verifyLink = `http://localhost:${PORT}/api/verify/${verificationToken}`;
        console.log(`\n📧 [EMAIL SIMULÉ pour ${email}]`);
        console.log(`Objet : Bienvenue sur Music Room ! Confirmez votre email`);
        console.log(`Cliquez sur ce lien pour activer votre compte : ${verifyLink}\n`);

        res.status(201).json({ message: "Compte créé ! Veuillez vérifier vos emails pour l'activer." });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: "Email déjà utilisé" });
        console.error(err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// --- ROUTE 2 : LA VÉRIFICATION DU LIEN ---
app.get('/api/verify/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const result = await db.query(
            'UPDATE users SET is_verified = true, verification_token = NULL WHERE verification_token = $1 RETURNING id',
            [token]
        );

        if (result.rowCount === 0) {
            return res.status(400).send("<h1>Lien invalide ou compte déjà vérifié.</h1>");
        }

        res.status(200).send("<h1>✅ Compte activé avec succès ! Vous pouvez maintenant vous connecter sur l'application.</h1>");
    } catch (err) {
        res.status(500).send("<h1>Erreur serveur</h1>");
    }
});

// --- ROUTE 3 : LE LOGIN (Avec blocage si non vérifié) ---
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await db.query('SELECT * FROM users WHERE email = $1 AND auth_provider = $2', [email, 'local']);
        
        if (result.rows.length === 0) return res.status(401).json({ error: "Identifiants incorrects" });
        
        const user = result.rows[0];

        // 🛑 LE VIDEUR : Vérifie si le compte est activé
        if (!user.is_verified) {
            return res.status(403).json({ error: "Veuillez cliquer sur le lien envoyé par email pour activer votre compte." });
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return res.status(401).json({ error: "Identifiants incorrects" });

        const token = jwt.sign(
            { userId: user.id, email: user.email }, 
            process.env.JWT_SECRET || 'mon_super_secret',
            { expiresIn: '24h' }
        );

        res.status(200).json({ message: "Connexion réussie", token, user: { id: user.id, email: user.email } });
    } catch (err) {
        res.status(500).json({ error: "Erreur serveur" });
    }
});

app.post('/api/events', async (req, res) => {
    try {
        const { name, isPrivate, isLocationRestricted } = req.body;
        if (!name) return res.status(400).json({ error: "Nom de l'événement requis" });

        const result = await db.query(
            'INSERT INTO events (name, is_private, location_restricted) VALUES ($1, $2, $3) RETURNING *',
            [name, isPrivate, isLocationRestricted]
        );
        
        res.status(201).json({ message: "Room créée avec succès", event: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: "Erreur serveur" });
    }
});

app.get('/api/events', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM events ORDER BY created_at DESC');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erreur serveur" });
    }
});

app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Aucun compte n'est associé à cette adresse email." });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetLink = `http://localhost:${PORT}/api/reset-password/${resetToken}`;
        
        console.log(`\n📧 [EMAIL SIMULÉ pour ${email}]`);
        console.log(`Objet : Réinitialisation de votre mot de passe Music Room`);
        console.log(`Cliquez sur ce lien pour créer un nouveau mot de passe : ${resetLink}\n`);

        res.status(200).json({ message: "Si cet email existe, un lien de réinitialisation a été envoyé." });
    } catch (err) {
        res.status(500).json({ error: "Erreur serveur" });
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
    console.log(`📱 Connecté : ${socket.id}`);

    socket.on('join_room', (roomId) => {
        socket.join(roomId);
        console.log(`👤 Rejoint la room : ${roomId}`);
    });

    socket.on('disconnect', () => {
        console.log(`📵 Déconnecté : ${socket.id}`);
    });
});

server.listen(PORT, () => {
    console.log(`🚀 API + WebSockets sur le port ${PORT}`);
});