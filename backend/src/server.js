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

  // Background jobs need Redis, so they are opt-in. If Redis is down the API keeps working.
  if (config.reminders.enabled) {
    try {
      await require('./jobs').startJobs();
    } catch (err) {
      console.error('Could not start the reminder job (is Redis running?):', err.message);
    }
  }
}

start();
