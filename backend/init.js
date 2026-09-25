const pool = require('./config/db');

const createTables = async () => {
  if (!process.argv.includes('--force')) {
    console.error('Refusing to run without --force. This command drops all tables.');
    process.exit(1);
  }

  const dropQuery = `DROP TABLE IF EXISTS activity_logs, event_delegations, devices, event_playback, track_votes, event_invitations, friendships, tracks, events, users CASCADE;`;

  const usersTable = `
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      username VARCHAR(20) UNIQUE NOT NULL,
      password VARCHAR(255),
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      birth_date DATE,

      is_verified BOOLEAN DEFAULT false,
      verification_token VARCHAR(255),

      reset_token VARCHAR(255),
      reset_token_expires TIMESTAMP,

      auth_provider VARCHAR(50) DEFAULT 'local',

      privacy_settings JSONB DEFAULT '{"first_name": "public", "last_name": "public", "birth_date": "private", "music_preferences": "friends"}',
      music_preferences JSONB DEFAULT '[]',

      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const eventsTable = `
    CREATE TABLE events (
      id SERIAL PRIMARY KEY,
      owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      is_private BOOLEAN DEFAULT false,
      location_restricted BOOLEAN DEFAULT false,
      location_lat DOUBLE PRECISION,
      location_lng DOUBLE PRECISION,
      location_radius_m INTEGER DEFAULT 100,
      vote_window_start TIME,
      vote_window_end TIME,
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
      cover_url VARCHAR(255),
      preview_url VARCHAR(500),
      duration_ms INTEGER DEFAULT 30000,
      played BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const trackVotesTable = `
    CREATE TABLE track_votes (
      id SERIAL PRIMARY KEY,
      track_id INTEGER REFERENCES tracks(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      value SMALLINT NOT NULL CHECK (value IN (-1, 1)),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (track_id, user_id)
    );
  `;

  const friendshipsTable = `
    CREATE TABLE friendships (
      id SERIAL PRIMARY KEY,
      requester_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      addressee_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CHECK (requester_id != addressee_id),
      UNIQUE (requester_id, addressee_id)
    );
  `;

  const eventInvitationsTable = `
    CREATE TABLE event_invitations (
      id SERIAL PRIMARY KEY,
      event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      invited_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (event_id, user_id)
    );
  `;

  const eventPlaybackTable = `
    CREATE TABLE event_playback (
      event_id INTEGER PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
      current_track_id INTEGER REFERENCES tracks(id) ON DELETE SET NULL,
      started_at TIMESTAMP,
      duration_ms INTEGER
    );
  `;

  const devicesTable = `
    CREATE TABLE devices (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      device_uid VARCHAR(255) NOT NULL,
      platform VARCHAR(50),
      device_name VARCHAR(255),
      last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, device_uid)
    );
  `;

  const eventDelegationsTable = `
    CREATE TABLE event_delegations (
      id SERIAL PRIMARY KEY,
      event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
      granted_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (event_id, user_id)
    );
  `;

  const activityLogsTable = `
    CREATE TABLE activity_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(150) NOT NULL,
      platform VARCHAR(50),
      device_name VARCHAR(255),
      app_version VARCHAR(50),
      metadata JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    console.log("Cleaning up the old database...");
    await pool.query(dropQuery);

    console.log("Creating the schema...");
    await pool.query(usersTable);
    await pool.query(eventsTable);
    await pool.query(tracksTable);
    await pool.query(trackVotesTable);
    await pool.query(friendshipsTable);
    await pool.query(eventInvitationsTable);
    await pool.query(eventPlaybackTable);
    await pool.query(devicesTable);
    await pool.query(eventDelegationsTable);
    await pool.query(activityLogsTable);
    console.log("Tables ready!");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    process.exit();
  }
};

createTables();