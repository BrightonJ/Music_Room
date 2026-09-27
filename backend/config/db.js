const { Pool, types } = require('pg');
require('dotenv').config({ quiet: true });

// DATE columns (OID 1082) are returned as plain 'YYYY-MM-DD' strings.
// By default node-postgres builds a Date at local midnight, which JSON then
// serializes in UTC: on a server set to Paris time the birth date moves back
// one day on every read.
types.setTypeParser(1082, (value) => value);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX) || 20,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL client error:', err.message);
});

module.exports = pool;
