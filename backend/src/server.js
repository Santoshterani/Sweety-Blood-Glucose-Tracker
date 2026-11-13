const app = require('./app');
const config = require('./config');
const applySchema = require('./db/init');
const { pool } = require('./db/pool');

async function start() {
  try {
    await applySchema();
  } catch (err) {
    console.error('Could not initialise the database schema:', err.message);
    await pool.end();
    process.exitCode = 1;
    return;
  }

  app.listen(config.port, () => {
    console.log(`Sweety API running on http://localhost:${config.port}`);
  });
}

start();
