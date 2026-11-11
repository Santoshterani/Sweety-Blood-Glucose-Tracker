/**
 * Highest, lowest, average (1 decimal) and count for a list of glucose values.
 * With no values we return nulls so the UI can show an empty state.
 */
function summarize(values) {
  const count = values.length;
  if (count === 0) {
    return { count: 0, highest: null, lowest: null, average: null };
  }
  const sum = values.reduce((total, v) => total + v, 0);
  return {
    count,
    highest: Math.max(...values),
    lowest: Math.min(...values),
    // Values are whole numbers, so this rounds half-up exactly: 110.25 -> 110.3
    average: Math.round((sum * 10) / count) / 10,
  };
}

module.exports = { summarize };
