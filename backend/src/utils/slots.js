// The 4 time slots, in the order they happen during the day.
const SLOTS = [
  { value: 'morning', label: 'Morning (fasting)' },
  { value: 'after_breakfast', label: 'After breakfast' },
  { value: 'after_lunch', label: 'After lunch' },
  { value: 'after_dinner', label: 'After dinner' },
];

const SLOT_VALUES = SLOTS.map((s) => s.value);
const SLOT_LABELS = Object.fromEntries(SLOTS.map((s) => [s.value, s.label]));

const MAX_READINGS_PER_DAY = SLOTS.length;
const MIN_VALUE = 40;
const MAX_VALUE = 600;

module.exports = { SLOTS, SLOT_VALUES, SLOT_LABELS, MAX_READINGS_PER_DAY, MIN_VALUE, MAX_VALUE };
