const userRepository = require('../repositories/user.repository');
const readingRepository = require('../repositories/reading.repository');
const { HttpError } = require('../utils/httpError');
const { addDays } = require('../utils/dates');
const { summarize } = require('../utils/stats');
const { SLOTS } = require('../utils/slots');
const { toReadingSummary } = require('../utils/mappers');

/**
 * Everything the home screen needs in one call: today's four slots, a 7-day summary,
 * a 14-day trend and the most recent readings.
 */
async function getDashboard(userId, date) {
  const user = await userRepository.findById(userId);
  if (!user) throw new HttpError(401, 'Your session has expired. Please log in again.');
  const target = { low: user.target_low, high: user.target_high };

  // One query for the 14-day window; the 7-day summary and "today" are cut out of it.
  const weekFrom = addDays(date, -6);
  const windowRows = await readingRepository.findInRange(userId, addDays(date, -13), date);

  const todayRows = windowRows.filter((r) => r.reading_date === date);
  const slots = SLOTS.map((s) => {
    const row = todayRows.find((r) => r.slot === s.value);
    return { slot: s.value, label: s.label, reading: row ? { id: row.id, value: row.value } : null };
  });

  const weekRows = windowRows.filter((r) => r.reading_date >= weekFrom);
  const inRange = weekRows.filter((r) => r.value >= target.low && r.value <= target.high).length;
  const highestRow = weekRows.reduce((best, r) => (!best || r.value > best.value ? r : best), null);
  const lowestRow = weekRows.reduce((best, r) => (!best || r.value < best.value ? r : best), null);

  const trend = [];
  for (let i = 13; i >= 0; i--) {
    const day = addDays(date, -i);
    const values = windowRows.filter((r) => r.reading_date === day).map((r) => r.value);
    trend.push({ date: day, count: values.length, average: summarize(values).average });
  }

  const recent = await readingRepository.findRecent(userId, date, 6);

  return {
    date,
    name: user.name,
    target,
    today: { logged: todayRows.length, slots },
    week: {
      ...summarize(weekRows.map((r) => r.value)),
      inRangePercent: weekRows.length ? Math.round((inRange / weekRows.length) * 100) : null,
      highestReading: toReadingSummary(highestRow),
      lowestReading: toReadingSummary(lowestRow),
    },
    trend,
    recent: recent.map(toReadingSummary),
  };
}

module.exports = { getDashboard };
