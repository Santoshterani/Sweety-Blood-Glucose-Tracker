const { Pool, types } = require('pg');
const config = require('../config');

// By default pg turns DATE columns into JS Date objects, which silently shift by timezone.
// We keep them as plain 'YYYY-MM-DD' strings instead.
types.setTypeParser(types.builtins.DATE, (value) => value);
// COUNT(*) and other bigint values come back as strings by default; our counts are small.
types.setTypeParser(types.builtins.INT8, (value) => Number(value));

const pool = new Pool({ connectionString: config.databaseUrl, max: 10 });

/** Runs one statement on the pool. Returns pg's result ({ rows, rowCount, ... }). */
const query = (text, params) => pool.query(text, params);

/**
 * Runs `work(client)` inside a transaction: COMMIT if it resolves, ROLLBACK if it throws.
 * Repositories accept the `client` so several statements share the same transaction.
 */
async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** PostgreSQL error 23505 = unique_violation. `constraint` tells us which one. */
const isUniqueViolation = (err, constraint) =>
  err && err.code === '23505' && (!constraint || err.constraint === constraint);

module.exports = { pool, query, withTransaction, isUniqueViolation };
