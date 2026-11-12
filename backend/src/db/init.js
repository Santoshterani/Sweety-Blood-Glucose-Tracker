// Run with: npm run db:init
const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

/** Runs schema.sql. PostgreSQL accepts several statements in one query, so no splitting is needed. */
async function applySchema() {
  const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'schema.sql'), 'utf8');
  await pool.query(sql);
}

module.exports = applySchema;

if (require.main === module) {
  applySchema()
    .then(() => {
      console.log('Database schema is ready.');
      return pool.end();
    })
    .catch((err) => {
      console.error('Could not initialise the database:', err.message);
      process.exit(1);
    });
}
