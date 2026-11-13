const { summarize } = require('./stats');
const { SLOT_LABELS } = require('./slots');
const { addDays, diffDays } = require('./dates');

const SLOT_SHORT = {
  morning: 'Morning',
  after_breakfast: 'Breakfast',
  after_lunch: 'Lunch',
  after_dinner: 'Dinner',
};

const fmt = (dateStr, options) =>
  new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(new Date(`${dateStr}T00:00:00Z`));

const round1 = (n) => Math.round(n * 10) / 10;

/** How a report is broken down: one row per reading, day, week or month. */
function bucketModeFor(type, from, to) {
  if (type === 'daily') return 'slot';
  if (type === 'weekly') return 'day';
  if (type === 'monthly' || type === 'month-to-date') return 'week';
  if (type === 'yearly') return 'month';
  // custom: pick the most readable breakdown for the length of the range
  const days = diffDays(from, to) + 1;
  if (days <= 14) return 'day';
  if (days <= 92) return 'week';
  return 'month';
}

function describe(mode, first, last) {
  if (mode === 'day') {
    return {
      name: fmt(first, { weekday: 'short', day: 'numeric', month: 'short' }),
      label: fmt(first, { weekday: 'short', day: 'numeric' }),
    };
  }
  if (mode === 'week') {
    const short = { day: 'numeric', month: 'short' };
    return { name: `${fmt(first, short)} – ${fmt(last, short)}`, label: fmt(first, short) };
  }
  return {
    name: fmt(first, { month: 'long', year: 'numeric' }),
    label: fmt(first, { month: 'short' }),
  };
}

/** Groups readings into day / week / month buckets. Buckets with no readings are left out. */
function groupReadings(rows, mode, from, to) {
  const buckets = new Map();
  for (const row of rows) {
    const date = row.reading_date;
    let key;
    if (mode === 'day') key = date;
    else if (mode === 'week') key = Math.floor(diffDays(from, date) / 7);
    else key = date.slice(0, 7);

    if (!buckets.has(key)) buckets.set(key, { first: date, last: date, values: [], readings: [] });
    const bucket = buckets.get(key);
    if (mode === 'week') {
      // Week buckets always span exactly 7 days from the start of the range.
      bucket.first = addDays(from, key * 7);
      // The last week is cut off at the end of the range instead of running past it.
      const weekEnd = addDays(from, key * 7 + 6);
      bucket.last = weekEnd > to ? to : weekEnd;
    } else if (mode === 'month') {
      bucket.first = `${key}-01`;
      bucket.last = date;
    }
    bucket.values.push(row.value);
    bucket.readings.push({
      id: row.id,
      date,
      slot: row.slot,
      slotLabel: SLOT_LABELS[row.slot],
      value: row.value,
    });
  }

  return [...buckets.values()].map((b) => {
    const s = summarize(b.values);
    return {
      ...describe(mode, b.first, b.last),
      count: s.count,
      low: s.lowest,
      avg: s.average,
      high: s.highest,
      readings: b.readings,
    };
  });
}

/**
 * Builds the report the API returns (and the PDF prints).
 * `rows` are the user's readings in the range, ordered by date then slot.
 */
function buildReport({ type, from, to, rows }) {
  const bucketBy = bucketModeFor(type, from, to);

  let buckets;
  if (bucketBy === 'slot') {
    buckets = rows.map((r) => ({
      name: SLOT_LABELS[r.slot],
      label: SLOT_SHORT[r.slot],
      count: 1,
      low: r.value,
      avg: r.value,
      high: r.value,
    }));
  } else {
    buckets = groupReadings(rows, bucketBy, from, to);
  }

  const report = { type, from, to, ...summarize(rows.map((r) => r.value)), bucketBy, buckets };

  if (type === 'daily') {
    report.readings = rows.map((r) => ({
      id: r.id,
      date: r.reading_date,
      slot: r.slot,
      slotLabel: SLOT_LABELS[r.slot],
      value: r.value,
    }));
  }
  return report;
}

module.exports = { buildReport, bucketModeFor, round1 };
