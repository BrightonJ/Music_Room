const pool = require('./config/db');

const createTables = async () => {
  const usersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // NOUVELLE TABLE POUR LES ROOMS
  const eventsTable = `
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      is_private BOOLEAN DEFAULT false,
      location_restricted BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    console.log("⏳ Création des tables en cours...");
    await pool.query(usersTable);
    await pool.query(eventsTable); // On exécute la création de la table events
    console.log("✅ Tables 'users' et 'events' prêtes !");
  } catch (err) {
    console.error("❌ Erreur lors de la création :", err);
  } finally {
    process.exit();
  }
};

createTables();