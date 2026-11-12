// All SQL for the `readings` table. No business rules here, just queries.
// Every function takes an optional `executor` (the pool by default, or a transaction client).
const db = require('../db');

// Sort morning -> dinner within a day.
const SLOT_ORDER_SQL = `CASE slot
  WHEN 'morning' THEN 1 WHEN 'after_breakfast' THEN 2 WHEN 'after_lunch' THEN 3 ELSE 4 END`;

/** Builds "WHERE user_id = $1 [AND reading_date = $2] [AND slot = $3]" and its parameters. */
function buildFilter({ userId, date, slot }) {
  const params = [userId];
  let where = 'WHERE user_id = $1';
  if (date) {
    params.push(date);
    where += ` AND reading_date = $${params.length}`;
  }
  if (slot) {
    params.push(slot);
    where += ` AND slot = $${params.length}`;
  }
  return { where, params };
}

const count = async (filter, executor = db) => {
  const { where, params } = buildFilter(filter);
  const { rows } = await executor.query(`SELECT COUNT(*)::int AS total FROM readings ${where}`, params);
  return rows[0].total;
};

/** One page of readings, newest day first, morning -> dinner within a day. */
const findPage = async (filter, { limit, offset }, executor = db) => {
  const { where, params } = buildFilter(filter);
  const { rows } = await executor.query(
    `SELECT * FROM readings ${where}
     ORDER BY reading_date DESC, ${SLOT_ORDER_SQL}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  return rows;
};

/** The user's readings for one day (optionally ignoring one reading, for edits). */
const findByDay = async (userId, date, excludeId = null, executor = db) => {
  const { rows } = await executor.query(
    'SELECT id, slot FROM readings WHERE user_id = $1 AND reading_date = $2 AND ($3::int IS NULL OR id <> $3)',
    [userId, date, excludeId]
  );
  return rows;
};

const existsForUser = async (id, userId, executor = db) => {
  const { rows } = await executor.query('SELECT 1 FROM readings WHERE id = $1 AND user_id = $2', [id, userId]);
  return rows.length > 0;
};

const insert = async ({ userId, date, slot, value }, executor = db) => {
  const { rows } = await executor.query(
    'INSERT INTO readings (user_id, reading_date, slot, value) VALUES ($1, $2, $3, $4) RETURNING *',
    [userId, date, slot, value]
  );
  return rows[0];
};

const update = async (id, userId, { date, slot, value }, executor = db) => {
  const { rows } = await executor.query(
    `UPDATE readings SET reading_date = $1, slot = $2, value = $3, updated_at = NOW()
     WHERE id = $4 AND user_id = $5
     RETURNING *`,
    [date, slot, value, id, userId]
  );
  return rows[0] || null;
};

/** Returns true if a row was deleted. */
const remove = async (id, userId, executor = db) => {
  const { rowCount } = await executor.query('DELETE FROM readings WHERE id = $1 AND user_id = $2', [id, userId]);
  return rowCount > 0;
};

/** Every reading in [from, to] (inclusive), oldest first. */
const findInRange = async (userId, from, to, executor = db) => {
  const { rows } = await executor.query(
    `SELECT id, reading_date, slot, value FROM readings
     WHERE user_id = $1 AND reading_date BETWEEN $2 AND $3
     ORDER BY reading_date, ${SLOT_ORDER_SQL}`,
    [userId, from, to]
  );
  return rows;
};

/** The most recent readings on or before `upTo`, newest first. */
const findRecent = async (userId, upTo, limit, executor = db) => {
  const { rows } = await executor.query(
    `SELECT id, reading_date, slot, value FROM readings
     WHERE user_id = $1 AND reading_date <= $2
     ORDER BY reading_date DESC, ${SLOT_ORDER_SQL} DESC
     LIMIT $3`,
    [userId, upTo, limit]
  );
  return rows;
};

module.exports = { count, findPage, findByDay, existsForUser, insert, update, remove, findInRange, findRecent };
