const express = require('express');
const config = require('../config');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { validationError } = require('../utils/httpError');
const {
  isValidDateString,
  isFutureDate,
  todayInTimezone,
  monthToDateRange,
  previousMonthRange,
} = require('../utils/dates');
const { summarize } = require('../utils/stats');
const { SLOT_LABELS } = require('../utils/slots');

const router = express.Router();
router.use(requireAuth);

const SLOT_ORDER_SQL = `CASE slot
  WHEN 'morning' THEN 1 WHEN 'after_breakfast' THEN 2 WHEN 'after_lunch' THEN 3 ELSE 4 END`;

/** ?date=YYYY-MM-DD (defaults to today). Must be a real date and not in the future. */
function getSelectedDate(query) {
  const today = todayInTimezone(config.timezone);
  const date = query.date || today;
  if (!isValidDateString(date)) throw validationError({ date: 'Please enter a valid date (YYYY-MM-DD).' });
  if (isFutureDate(date, today)) throw validationError({ date: 'Date cannot be in the future.' });
  return date;
}

async function readingsBetween(userId, from, to) {
  const { rows } = await db.query(
    `SELECT id, reading_date, slot, value FROM readings
     WHERE user_id = $1 AND reading_date BETWEEN $2 AND $3
     ORDER BY reading_date, ${SLOT_ORDER_SQL}`,
    [userId, from, to]
  );
  return rows;
}

// GET /api/reports/daily?date=2026-10-15  -> that day, plus each reading with its slot
router.get('/daily', async (req, res) => {
  const date = getSelectedDate(req.query);
  const rows = await readingsBetween(req.user.id, date, date);

  res.json({
    type: 'daily',
    from: date,
    to: date,
    ...summarize(rows.map((r) => r.value)),
    readings: rows.map((r) => ({
      id: r.id,
      date: r.reading_date,
      slot: r.slot,
      slotLabel: SLOT_LABELS[r.slot],
      value: r.value,
    })),
  });
});

// GET /api/reports/month-to-date?date=2026-10-15  -> 1 Oct to 15 Oct
router.get('/month-to-date', async (req, res) => {
  const { from, to } = monthToDateRange(getSelectedDate(req.query));
  const rows = await readingsBetween(req.user.id, from, to);
  res.json({ type: 'month-to-date', from, to, ...summarize(rows.map((r) => r.value)) });
});

// GET /api/reports/monthly?date=2026-10-15  -> the whole of September
router.get('/monthly', async (req, res) => {
  const { from, to } = previousMonthRange(getSelectedDate(req.query));
  const rows = await readingsBetween(req.user.id, from, to);
  res.json({ type: 'monthly', from, to, ...summarize(rows.map((r) => r.value)) });
});

module.exports = router;
