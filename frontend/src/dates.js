// Dates are plain 'YYYY-MM-DD' strings, same as the API.

const pad = (n) => String(n).padStart(2, '0');
const utc = (str) => {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const format = (str, options) => new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(utc(str));

/** Today's date in the browser's timezone as YYYY-MM-DD. */
export function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** '2026-10-15' + 3 -> '2026-10-18' (negative goes back). */
export function addDays(str, days) {
  return new Date(utc(str).getTime() + days * 86400000).toISOString().slice(0, 10);
}

/** '2026-10-15' -> '15 Oct 2026' */
export function formatDate(str) {
  return format(str, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** '2026-10-15' -> 'Thursday, 15 Oct 2026' */
export function formatLongDate(str) {
  return format(str, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
}

/** '2026-10-15' -> 'Thu, 15 Oct' */
export function formatShortDate(str) {
  return format(str, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** '2026-10-01' -> 'October 2026' */
export function formatMonth(str) {
  return format(str, { month: 'long', year: 'numeric' });
}

/** One date for a single day, otherwise '1 Oct – 15 Oct 2026'. */
export function formatRange(from, to) {
  if (from === to) return formatDate(from);
  const start = formatDate(from);
  // Drop the repeated year on the start date: "1 Oct – 15 Oct 2026"
  return from.slice(0, 4) === to.slice(0, 4)
    ? `${start.replace(/ \d{4}$/, '')} – ${formatDate(to)}`
    : `${start} – ${formatDate(to)}`;
}
