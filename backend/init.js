require('dotenv').config({ quiet: true });
const pool = require('./config/db');
const { resetSchema } = require('./db/schema');

(async () => {
  if (!process.argv.includes('--force')) {
    console.error('Refusing to run without --force. This command drops all tables.');
    process.exit(1);
  }
  try {
    console.log('Dropping the old schema and creating the new one...');
    await resetSchema(pool);
    console.log('Tables ready!');
  } catch (err) {
    console.error('Error:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
