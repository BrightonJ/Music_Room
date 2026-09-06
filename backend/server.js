require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt'); // L'outil de sécurité
const db = require('./config/db');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- ROUTE D'INSCRIPTION ---
app.post('/api/register', async (req, res) => {
    try {
        // 1. On récupère les infos envoyées par le Front-end
        const { email, password } = req.body;

        // 2. On vérifie que tout est là
        if (!email || !password) {
            return res.status(400).json({ error: "L'email et le mot de passe sont requis" });
        }

        // 3. On sécurise le mot de passe
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // 4. On sauvegarde dans PostgreSQL
        const result = await db.query(
            'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email',
            [email, hashedPassword]
        );

        // 5. On répond au Front-end que tout s'est bien passé
        res.status(201).json({ 
            message: "Utilisateur créé avec succès !",
            user: result.rows[0] 
        });

    } catch (err) {
        // Erreur 23505 = Email déjà existant dans PostgreSQL
        if (err.code === '23505') {
            return res.status(409).json({ error: "Cet email est déjà utilisé" });
        }
        console.error(err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

app.get('/api/events', async (req, res) => {
    try {
        // On récupère toutes les rooms, de la plus récente à la plus ancienne
        const result = await db.query('SELECT * FROM events ORDER BY created_at DESC');
        res.status(200).json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur serveur lors de la récupération" });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Vérifier si l'utilisateur existe
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: "Email ou mot de passe incorrect" });
        }

        const user = result.rows[0];

        // 2. Vérifier le mot de passe crypté
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: "Email ou mot de passe incorrect" });
        }

        // 3. Créer le "Badge" (Token JWT)
        // (En entreprise, le secret 'mon_super_secret' doit être dans le .env)
        const token = jwt.sign(
            { userId: user.id, email: user.email }, 
            process.env.JWT_SECRET || 'mon_super_secret',
            { expiresIn: '24h' }
        );

        // 4. Renvoyer le token et les infos au Front-end
        res.status(200).json({
            message: "Connexion réussie !",
            token: token,
            user: { id: user.id, email: user.email }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// --- ROUTE CRÉATION D'ÉVÉNEMENT (ROOM) ---
app.post('/api/events', async (req, res) => {
    try {
        const { name, isPrivate, isLocationRestricted } = req.body;

        if (!name) {
            return res.status(400).json({ error: "Le nom de l'événement est requis" });
        }

        // On insère l'événement dans la base de données
        const result = await db.query(
            'INSERT INTO events (name, is_private, location_restricted) VALUES ($1, $2, $3) RETURNING *',
            [name, isPrivate, isLocationRestricted]
        );

        res.status(201).json({ 
            message: "Room créée avec succès !",
            event: result.rows[0]
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur serveur lors de la création de la Room" });
    }
});