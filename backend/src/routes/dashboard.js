const express = require('express');
const config = require('../config');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { HttpError, validationError } = require('../utils/httpError');
const { isValidDateString, isFutureDate, todayInTimezone, addDays } = require('../utils/dates');
const { summarize } = require('../utils/stats');
const { SLOTS, SLOT_LABELS } = require('../utils/slots');

const router = express.Router();
router.use(requireAuth);

const SLOT_ORDER_SQL = `CASE slot
  WHEN 'morning' THEN 1 WHEN 'after_breakfast' THEN 2 WHEN 'after_lunch' THEN 3 ELSE 4 END`;

const pickReading = (row) =>
  row ? { id: row.id, date: row.reading_date, slot: row.slot, slotLabel: SLOT_LABELS[row.slot], value: row.value } : null;

// GET /api/dashboard?date=YYYY-MM-DD   (defaults to today)
// Everything the home screen needs in one call: today's four slots, a 7-day summary,
// a 14-day trend and the most recent readings.
router.get('/', async (req, res) => {
  const today = todayInTimezone(config.timezone);
  const date = req.query.date || today;
  if (!isValidDateString(date)) throw validationError({ date: 'Please enter a valid date (YYYY-MM-DD).' });
  if (isFutureDate(date, today)) throw validationError({ date: 'Date cannot be in the future.' });

  const userResult = await db.query('SELECT name, target_low, target_high FROM users WHERE id = ?', [req.user.id]);
  const user = userResult.rows[0];
  if (!user) throw new HttpError(401, 'Your session has expired. Please log in again.');
  const target = { low: user.target_low, high: user.target_high };

  // One query for the 14-day window; the 7-day summary and "today" are cut out of it.
  const trendFrom = addDays(date, -13);
  const weekFrom = addDays(date, -6);
  const windowResult = await db.query(
    `SELECT id, reading_date, slot, value FROM readings
     WHERE user_id = ? AND reading_date BETWEEN ? AND ?
     ORDER BY reading_date, ${SLOT_ORDER_SQL}`,
    [req.user.id, trendFrom, date]
  );
  const windowRows = windowResult.rows;

  const todayRows = windowRows.filter((r) => r.reading_date === date);
  const slots = SLOTS.map((s) => {
    const row = todayRows.find((r) => r.slot === s.value);
    return { slot: s.value, label: s.label, reading: row ? { id: row.id, value: row.value } : null };
  });

  const weekRows = windowRows.filter((r) => r.reading_date >= weekFrom);
  const weekSummary = summarize(weekRows.map((r) => r.value));
  const inRange = weekRows.filter((r) => r.value >= target.low && r.value <= target.high).length;
  const highestRow = weekRows.reduce((best, r) => (!best || r.value > best.value ? r : best), null);
  const lowestRow = weekRows.reduce((best, r) => (!best || r.value < best.value ? r : best), null);

  const trend = [];
  for (let i = 13; i >= 0; i--) {
    const day = addDays(date, -i);
    const values = windowRows.filter((r) => r.reading_date === day).map((r) => r.value);
    trend.push({ date: day, count: values.length, average: summarize(values).average });
  }

  const recentResult = await db.query(
    `SELECT id, reading_date, slot, value FROM readings
     WHERE user_id = ? AND reading_date <= ?
     ORDER BY reading_date DESC, ${SLOT_ORDER_SQL} DESC
     LIMIT 6`,
    [req.user.id, date]
  );

  res.json({
    date,
    name: user.name,
    target,
    today: { logged: todayRows.length, slots },
    week: {
      ...weekSummary,
      inRangePercent: weekRows.length ? Math.round((inRange / weekRows.length) * 100) : null,
      highestReading: pickReading(highestRow),
      lowestReading: pickReading(lowestRow),
    },
    trend,
    recent: recentResult.rows.map(pickReading),
  });
});

module.exports = router;
