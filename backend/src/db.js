const { Pool, types } = require('pg');
const config = require('./config');

// By default `pg` turns DATE columns into JS Date objects, which silently shift
// by the server's timezone. We keep them as plain 'YYYY-MM-DD' strings instead.
types.setTypeParser(1082, (value) => value);

const pool = new Pool({ connectionString: config.databaseUrl });

module.exports = {
  query: (text, params) => pool.query(text, params),
  // Used for transactions: const client = await db.getClient(); ... client.release()
  getClient: () => pool.connect(),
  pool,
};
