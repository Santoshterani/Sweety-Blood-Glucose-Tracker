const { SLOT_LABELS } = require('./slots');

/** A full `readings` row -> the object the API returns. */
const toReading = (row) => ({
  id: row.id,
  date: row.reading_date,
  slot: row.slot,
  slotLabel: SLOT_LABELS[row.slot],
  value: row.value,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** A slimmer reading used by the dashboard. */
const toReadingSummary = (row) =>
  row ? { id: row.id, date: row.reading_date, slot: row.slot, slotLabel: SLOT_LABELS[row.slot], value: row.value } : null;

module.exports = { toReading, toReadingSummary };
