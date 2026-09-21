
const { Pool } = require('pg');
require('dotenv').config();

// Initialize the PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test the connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ PostgreSQL connection error:', err.stack);
  } else {
    console.log('✅ Successfully connected to the PostgreSQL database!');
    release();
  }
});

module.exports = pool;