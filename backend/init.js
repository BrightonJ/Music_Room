const pool = require('./config/db');

const createTables = async () => {
  // ⚠️ ON DÉTRUIT TOUT POUR REPARTIR À ZÉRO (Seulement en dev !)
  const dropQuery = `DROP TABLE IF EXISTS tracks, events, users CASCADE;`;

  // LA NOUVELLE TABLE USERS (Version Sécurisée & Complète)
  const usersTable = `
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255), -- Optionnel pour Google/Facebook
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      birth_date DATE,
      
      -- Système de Vérification Email
      is_verified BOOLEAN DEFAULT false,
      verification_token VARCHAR(255),
      
      -- Système OAuth (Google/Facebook)
      auth_provider VARCHAR(50) DEFAULT 'local',
      
      -- Gestion de la confidentialité (JSON pour la flexibilité)
      -- Ex: {"birth_date": "private", "last_name": "friends"}
      privacy_settings JSONB DEFAULT '{"first_name": "public", "last_name": "public", "birth_date": "private"}',
      
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const eventsTable = `
    CREATE TABLE events (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      is_private BOOLEAN DEFAULT false,
      location_restricted BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

const tracksTable = `
    CREATE TABLE tracks (
      id SERIAL PRIMARY KEY,
      event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      artist VARCHAR(255) NOT NULL,
      cover_url VARCHAR(255), -- NOUVELLE COLONNE POUR LA POCHETTE
      votes INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    console.log("🧨 Nettoyage de l'ancienne base...");
    await pool.query(dropQuery);
    
    console.log("⏳ Création de la nouvelle architecture V2...");
    await pool.query(usersTable);
    await pool.query(eventsTable);
    await pool.query(tracksTable);
    console.log("✅ Super-Tables prêtes !");
  } catch (err) {
    console.error("❌ Erreur :", err);
  } finally {
    process.exit();
  }
};

createTables();