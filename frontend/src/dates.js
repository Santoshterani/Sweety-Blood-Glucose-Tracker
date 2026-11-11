// Dates are plain 'YYYY-MM-DD' strings, same as the API.

const pad = (n) => String(n).padStart(2, '0');

/** Today's date in the browser's timezone as YYYY-MM-DD. */
export function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** '2026-10-15' -> '15 Oct 2026' */
export function formatDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d))
  );
}

/** Same date twice -> one date; otherwise '1 Oct – 15 Oct 2026' style range. */
export function formatRange(from, to) {
  if (from === to) return formatDate(from);
  const start = formatDate(from);
  const end = formatDate(to);
  // Drop the repeated year on the start date: "1 Oct – 15 Oct 2026"
  return from.slice(0, 4) === to.slice(0, 4) ? `${start.replace(/ \d{4}$/, '')} – ${end}` : `${start} – ${end}`;
}
