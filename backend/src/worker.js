// A separate process that only runs background jobs:  npm run worker
// (The API can also run them itself when REMINDERS_ENABLED=true.)
const applySchema = require('./db/init');
const { pool } = require('./db/pool');
const { startJobs, stopJobs } = require('./jobs');

async function main() {
  await applySchema();
  await startJobs();
  console.log('Worker running. Press Ctrl+C to stop.');

  const shutdown = async () => {
    await stopJobs();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Worker could not start:', err.message);
  process.exit(1);
});
