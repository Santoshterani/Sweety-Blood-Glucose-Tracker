// All dates in this app are plain 'YYYY-MM-DD' strings (no time, no timezone).
// We do the arithmetic in UTC so the server's own timezone can never shift a day.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True only for real calendar dates, e.g. '2026-02-30' is rejected. */
function isValidDateString(str) {
  if (typeof str !== 'string') return false;
  const match = DATE_RE.exec(str);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

const pad = (n) => String(n).padStart(2, '0');
const format = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

/** Today's date as 'YYYY-MM-DD' in the given IANA timezone. */
function todayInTimezone(timeZone, now = new Date()) {
  // The 'en-CA' locale formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function isFutureDate(dateStr, today) {
  // Same-length ISO strings sort correctly as plain strings.
  return dateStr > today;
}

function lastDayOfMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate(); // day 0 of next month
}

/** 1st of the month -> the selected date. */
function monthToDateRange(dateStr) {
  const [y, m] = dateStr.split('-').map(Number);
  return { from: format(y, m, 1), to: dateStr };
}

/** The whole month before the selected date's month. */
function previousMonthRange(dateStr) {
  let [y, m] = dateStr.split('-').map(Number);
  m -= 1;
  if (m === 0) {
    m = 12;
    y -= 1;
  }
  return { from: format(y, m, 1), to: format(y, m, lastDayOfMonth(y, m)) };
}

module.exports = {
  isValidDateString,
  todayInTimezone,
  isFutureDate,
  monthToDateRange,
  previousMonthRange,
};
