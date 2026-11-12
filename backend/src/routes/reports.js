const express = require('express');
const config = require('../config');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { HttpError, validationError } = require('../utils/httpError');
const {
  isValidDateString,
  isFutureDate,
  todayInTimezone,
  diffDays,
  monthToDateRange,
  previousMonthRange,
  lastSevenDaysRange,
  yearToDateRange,
} = require('../utils/dates');
const { buildReport } = require('../utils/reportBuilder');
const { renderReportPdf } = require('../utils/pdfReport');
const { toProfile } = require('../utils/profile');

const router = express.Router();
router.use(requireAuth);

const SLOT_ORDER_SQL = `CASE slot
  WHEN 'morning' THEN 1 WHEN 'after_breakfast' THEN 2 WHEN 'after_lunch' THEN 3 ELSE 4 END`;

const TYPES = ['daily', 'weekly', 'monthly', 'yearly', 'month-to-date', 'custom'];
const MAX_CUSTOM_DAYS = 1827; // about 5 years

/** ?date=YYYY-MM-DD (defaults to today). Must be a real date and not in the future. */
function getSelectedDate(query, today) {
  const date = query.date || today;
  if (!isValidDateString(date)) throw validationError({ date: 'Please enter a valid date (YYYY-MM-DD).' });
  if (isFutureDate(date, today)) throw validationError({ date: 'Date cannot be in the future.' });
  return date;
}

/** Custom range: ?from=&to= — both required, real dates, not in the future, from <= to. */
function getCustomRange(query, today) {
  const errors = {};
  const { from, to } = query;

  if (!from) errors.from = 'Please select a start date.';
  else if (!isValidDateString(from)) errors.from = 'Please enter a valid start date (YYYY-MM-DD).';
  else if (isFutureDate(from, today)) errors.from = 'Date cannot be in the future.';

  if (!to) errors.to = 'Please select an end date.';
  else if (!isValidDateString(to)) errors.to = 'Please enter a valid end date (YYYY-MM-DD).';
  else if (isFutureDate(to, today)) errors.to = 'Date cannot be in the future.';

  if (!errors.from && !errors.to) {
    if (from > to) errors.to = 'End date must be on or after the start date.';
    else if (diffDays(from, to) + 1 > MAX_CUSTOM_DAYS) errors.to = 'Date range cannot be longer than 5 years.';
  }
  if (Object.keys(errors).length) throw validationError(errors);
  return { from, to };
}

/** Turns a report type + query into the date range it covers. */
function resolveRange(type, query) {
  const today = todayInTimezone(config.timezone);
  if (type === 'custom') return getCustomRange(query, today);

  const date = getSelectedDate(query, today);
  switch (type) {
    case 'daily':
      return { from: date, to: date };
    case 'weekly':
      return lastSevenDaysRange(date);
    case 'monthly':
      return previousMonthRange(date);
    case 'yearly':
      return yearToDateRange(date);
    default:
      return monthToDateRange(date); // 'month-to-date'
  }
}

function assertType(type) {
  if (!TYPES.includes(type)) throw new HttpError(404, 'Report type not found.');
}

async function loadReport(userId, type, query) {
  assertType(type);
  const { from, to } = resolveRange(type, query);
  const { rows } = await db.query(
    `SELECT id, reading_date, slot, value FROM readings
     WHERE user_id = ? AND reading_date BETWEEN ? AND ?
     ORDER BY reading_date, ${SLOT_ORDER_SQL}`,
    [userId, from, to]
  );
  return buildReport({ type, from, to, rows });
}

// GET /api/reports/pdf?type=weekly&date=2026-11-11   (or type=custom&from=&to=)
// Declared before '/:type' so "pdf" isn't read as a report type.
router.get('/pdf', async (req, res) => {
  const type = req.query.type || 'daily';
  const report = await loadReport(req.user.id, type, req.query);

  const { rows } = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
  const profile = toProfile(rows[0]);

  const pdf = await renderReportPdf({
    profile,
    report,
    generatedOn: todayInTimezone(config.timezone),
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="sweety-${type}-${report.to}.pdf"`);
  res.setHeader('Content-Length', pdf.length);
  res.send(pdf);
});

// GET /api/reports/:type   type = daily | weekly | monthly | yearly | month-to-date | custom
//   daily          ?date=             that day, plus each reading with its slot
//   weekly         ?date=             the 7 days ending on that date
//   monthly        ?date=             the whole previous month
//   yearly         ?date=             1 Jan -> that date
//   month-to-date  ?date=             1st of the month -> that date
//   custom         ?from=&to=         any range you choose
router.get('/:type', async (req, res) => {
  res.json(await loadReport(req.user.id, req.params.type, req.query));
});

module.exports = router;
