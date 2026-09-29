// Single source of truth for the database schema.
// Every date is TIMESTAMPTZ so that Node, PostgreSQL and the phones agree
// whatever their time zone.

const DROP_ALL = `DROP TABLE IF EXISTS activity_logs, event_delegations, event_playback, track_votes,
  tracks, event_invitations, friendships, devices, events, users CASCADE`;

const STATEMENTS = [
  `CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(20) UNIQUE NOT NULL,
    password VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    birth_date DATE,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    verification_token_hash VARCHAR(64),
    verification_expires_at TIMESTAMPTZ,
    reset_token_hash VARCHAR(64),
    reset_expires_at TIMESTAMPTZ,
    google_id VARCHAR(255) UNIQUE,
    privacy_settings JSONB NOT NULL DEFAULT '{"first_name": "public", "last_name": "public", "birth_date": "private", "music_preferences": "friends"}',
    music_preferences JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // One row per physical device of a user. session_id is copied in the JWT:
  // clearing it (logout) or deleting the row (device removal) revokes the token.
  `CREATE TABLE devices (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_uid VARCHAR(64) NOT NULL,
    platform VARCHAR(20) NOT NULL DEFAULT 'unknown',
    device_name VARCHAR(100) NOT NULL DEFAULT 'Unknown device',
    session_id VARCHAR(64),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, device_uid)
  )`,

  // Visibility (is_private) and vote license (vote_license) are two separate axes.
  `CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    is_private BOOLEAN NOT NULL DEFAULT false,
    vote_license VARCHAR(20) NOT NULL DEFAULT 'everyone'
      CHECK (vote_license IN ('everyone', 'invited', 'location')),
    location_lat DOUBLE PRECISION,
    location_lng DOUBLE PRECISION,
    location_radius_m INTEGER,
    vote_starts_at TIMESTAMPTZ,
    vote_ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (vote_license <> 'location' OR (
      location_lat IS NOT NULL AND location_lng IS NOT NULL AND location_radius_m IS NOT NULL
      AND vote_starts_at IS NOT NULL AND vote_ends_at IS NOT NULL AND vote_ends_at > vote_starts_at
    ))
  )`,

  // The preview URL is NOT stored here: Deezer signs it with a short-lived
  // token, a fresh one is fetched when the track starts playing.
  `CREATE TABLE tracks (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    deezer_id BIGINT NOT NULL,
    title VARCHAR(255) NOT NULL,
    artist VARCHAR(255) NOT NULL,
    cover_url VARCHAR(500),
    duration_ms INTEGER NOT NULL CHECK (duration_ms > 0 AND duration_ms <= 30000),
    status VARCHAR(10) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'playing', 'played')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  // A track can only be once in the queue (or playing) of an event: concurrent
  // additions of the same track are resolved by the database itself.
  `CREATE UNIQUE INDEX users_username_lower_idx ON users (LOWER(username))`,
  `CREATE UNIQUE INDEX tracks_one_active_per_event ON tracks (event_id, deezer_id) WHERE status <> 'played'`,
  `CREATE INDEX tracks_event_status_idx ON tracks (event_id, status)`,

  // One row per (track, user): an upsert is atomic, the score is SUM(value).
  `CREATE TABLE track_votes (
    track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    value SMALLINT NOT NULL CHECK (value IN (-1, 1)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (track_id, user_id)
  )`,

  `CREATE TABLE friendships (
    id SERIAL PRIMARY KEY,
    requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (requester_id <> addressee_id)
  )`,
  // A pair of users has at most one friendship row, whatever its direction
  `CREATE UNIQUE INDEX friendships_pair_idx ON friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id))`,
  `CREATE INDEX friendships_addressee_idx ON friendships (addressee_id, status)`,

  `CREATE TABLE event_invitations (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (event_id, user_id)
  )`,
  `CREATE INDEX event_invitations_user_idx ON event_invitations (user_id, status)`,

  // Playback state is persisted so that a server restart resumes the rooms.
  // While playing: position = now - started_at. While paused: position = position_ms.
  `CREATE TABLE event_playback (
    event_id INTEGER PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
    current_track_id INTEGER REFERENCES tracks(id) ON DELETE SET NULL,
    preview_url VARCHAR(1000),
    started_at TIMESTAMPTZ,
    position_ms INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER,
    is_playing BOOLEAN NOT NULL DEFAULT false,
    volume REAL NOT NULL DEFAULT 1 CHECK (volume >= 0 AND volume <= 1)
  )`,

  // Control is delegated to ONE DEVICE of a friend, not to the whole account.
  `CREATE TABLE event_delegations (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    granted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (event_id, device_id)
  )`,

  `CREATE TABLE activity_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(150) NOT NULL,
    platform VARCHAR(20),
    device_name VARCHAR(100),
    app_version VARCHAR(20),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX activity_logs_user_idx ON activity_logs (user_id, created_at)`,
];

async function resetSchema(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(DROP_ALL);
    for (const statement of STATEMENTS) {
      await client.query(statement);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { resetSchema };
