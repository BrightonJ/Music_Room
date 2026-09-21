const pool = require('./config/db');

const createTables = async () => {
  // ⚠️ DROP EVERYTHING TO START FROM SCRATCH (dev only!)
  const dropQuery = `DROP TABLE IF EXISTS tracks, events, users CASCADE;`;

  // NEW USERS TABLE (secure & complete version)
  const usersTable = `
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255), -- Optional for Google/Facebook
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      birth_date DATE,
      
      -- Email verification system
      is_verified BOOLEAN DEFAULT false,
      verification_token VARCHAR(255),
      
      -- OAuth system (Google/Facebook)
      auth_provider VARCHAR(50) DEFAULT 'local',
      
      -- Privacy management (JSON for flexibility)
      -- E.g. {"birth_date": "private", "last_name": "friends"}
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
      cover_url VARCHAR(255), -- NEW COLUMN FOR THE COVER ART
      votes INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    console.log("🧨 Cleaning up the old database...");
    await pool.query(dropQuery);
    
    console.log("⏳ Creating the new V2 schema...");
    await pool.query(usersTable);
    await pool.query(eventsTable);
    await pool.query(tracksTable);
    console.log("✅ Tables ready!");
  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    process.exit();
  }
};

createTables();