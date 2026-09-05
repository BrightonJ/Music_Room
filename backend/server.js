// 1. Importation des librairies
require('dotenv').config(); // Charge le fichier .env
const express = require('express');
const cors = require('cors');

// 2. Initialisation de l'application
const app = express();
const PORT = process.env.PORT || 3000;

// 3. Configuration des sécurités et formats
app.use(cors()); // Autorise le mobile à communiquer avec le serveur
app.use(express.json()); // Demande au serveur de parler en JSON

// 4. Création de la première route de test (API)
app.get('/api/test', (req, res) => {
    res.json({ 
        message: "Bienvenue sur l'API de Music Room !",
        status: "success"
    });
});

// 5. Lancement du serveur
app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});