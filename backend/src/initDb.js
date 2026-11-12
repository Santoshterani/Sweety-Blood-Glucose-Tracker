// Run with: npm run db:init
const applySchema = require('./applySchema');
const db = require('./db');

async function main() {
  await applySchema();
  console.log('Database schema is ready.');
  await db.pool.end();
}

main().catch((err) => {
  console.error('Could not initialise the database:', err.message);
  process.exit(1);
});
