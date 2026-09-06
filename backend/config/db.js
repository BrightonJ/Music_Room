
const { Pool } = require('pg');
require('dotenv').config();

// Initialisation de la connexion à PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test de la connexion
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Erreur de connexion à PostgreSQL :', err.stack);
  } else {
    console.log('✅ Connecté avec succès à la base de données PostgreSQL !');
    release();
  }
});

module.exports = pool;