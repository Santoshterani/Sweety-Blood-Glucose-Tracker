const express = require('express');
const config = require('../config');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { HttpError, validationError } = require('../utils/httpError');
const { validateReadingInput } = require('../utils/validation');
const { isValidDateString, todayInTimezone } = require('../utils/dates');
const { SLOT_LABELS, MAX_READINGS_PER_DAY } = require('../utils/slots');

const router = express.Router();
router.use(requireAuth); // every reading route needs a logged-in user

// Sort morning -> dinner within a day.
const SLOT_ORDER_SQL = `CASE slot
  WHEN 'morning' THEN 1 WHEN 'after_breakfast' THEN 2 WHEN 'after_lunch' THEN 3 ELSE 4 END`;

function toApi(row) {
  return {
    id: row.id,
    date: row.reading_date,
    slot: row.slot,
    slotLabel: SLOT_LABELS[row.slot],
    value: row.value,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const withArticle = (label) => `${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label}`;

function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, 'Reading not found.');
  return id;
}

/** Validate the request body, using "today" in the app's timezone for the future-date rule. */
function parseBody(body) {
  const today = todayInTimezone(config.timezone);
  const { errors, data } = validateReadingInput(body, today);
  if (Object.keys(errors).length) throw validationError(errors);
  return data;
}

/**
 * Rules that need the database. Must run inside a transaction that holds the user lock.
 * `excludeId` lets an edit ignore the reading being edited.
 *
 * Order matters: a full day is reported as "max 4 per day" before the per-slot check,
 * otherwise (with only 4 slots) the max-4 rule could never be reached.
 */
async function assertDayRules(client, userId, { date, slot }, excludeId = null) {
  const { rows } = await client.query(
    `SELECT id, slot FROM readings
     WHERE user_id = $1 AND reading_date = $2 AND ($3::int IS NULL OR id <> $3)`,
    [userId, date, excludeId]
  );

  if (rows.length >= MAX_READINGS_PER_DAY) {
    throw new HttpError(409, `You can add only ${MAX_READINGS_PER_DAY} readings per day.`, {
      date: `You can add only ${MAX_READINGS_PER_DAY} readings per day.`,
    });
  }
  if (rows.some((r) => r.slot === slot)) {
    const message = `You already have ${withArticle(SLOT_LABELS[slot])} reading for this date.`;
    throw new HttpError(409, message, { slot: message });
  }
}

/** Runs `work(client)` in a transaction, locking the user row so two requests can't race past the rules. */
async function inUserTransaction(userId, work) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    // Last line of defence: the database UNIQUE constraint caught a duplicate we somehow missed.
    if (err.code === '23505') {
      const message = 'You already have a reading for this slot and date.';
      throw new HttpError(409, message, { slot: message });
    }
    throw err;
  } finally {
    client.release();
  }
}

// GET /api/readings?date=YYYY-MM-DD&page=1&limit=20
router.get('/', async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

  const params = [req.user.id];
  let where = 'WHERE user_id = $1';
  if (req.query.date) {
    if (!isValidDateString(req.query.date)) {
      throw validationError({ date: 'Please enter a valid date (YYYY-MM-DD).' });
    }
    params.push(req.query.date);
    where += ` AND reading_date = $${params.length}`;
  }

  const countResult = await db.query(`SELECT COUNT(*)::int AS total FROM readings ${where}`, params);
  const total = countResult.rows[0].total;

  const { rows } = await db.query(
    `SELECT * FROM readings ${where}
     ORDER BY reading_date DESC, ${SLOT_ORDER_SQL}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, (page - 1) * limit]
  );

  res.json({
    data: rows.map(toApi),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// POST /api/readings
router.post('/', async (req, res) => {
  const data = parseBody(req.body);

  const reading = await inUserTransaction(req.user.id, async (client) => {
    await assertDayRules(client, req.user.id, data);
    const { rows } = await client.query(
      `INSERT INTO readings (user_id, reading_date, slot, value)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.id, data.date, data.slot, data.value]
    );
    return rows[0];
  });

  res.status(201).json({ reading: toApi(reading) });
});

// PUT /api/readings/:id
router.put('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const data = parseBody(req.body);

  const reading = await inUserTransaction(req.user.id, async (client) => {
    // Only the owner can edit; someone else's id looks exactly like a missing one.
    const existing = await client.query('SELECT id FROM readings WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (!existing.rows[0]) throw new HttpError(404, 'Reading not found.');

    await assertDayRules(client, req.user.id, data, id);
    const { rows } = await client.query(
      `UPDATE readings
       SET reading_date = $1, slot = $2, value = $3, updated_at = NOW()
       WHERE id = $4 AND user_id = $5 RETURNING *`,
      [data.date, data.slot, data.value, id, req.user.id]
    );
    return rows[0];
  });

  res.json({ reading: toApi(reading) });
});

// DELETE /api/readings/:id
router.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const { rowCount } = await db.query('DELETE FROM readings WHERE id = $1 AND user_id = $2', [id, req.user.id]);
  if (!rowCount) throw new HttpError(404, 'Reading not found.');
  res.status(204).end();
});

module.exports = router;
