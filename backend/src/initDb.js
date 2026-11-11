// Run with: npm run db:init
const fs = require('fs');
const path = require('path');
const db = require('./db');

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
  await db.query(sql);
  console.log('Database schema is ready.');
  await db.pool.end();
}

main().catch((err) => {
  console.error('Could not initialise the database:', err.message);
  process.exit(1);
});
