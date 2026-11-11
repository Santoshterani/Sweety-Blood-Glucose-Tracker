const { isValidDateString, isFutureDate } = require('./dates');
const { SLOT_VALUES, MIN_VALUE, MAX_VALUE } = require('./slots');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VALUE_RANGE_MESSAGE = `Value must be between ${MIN_VALUE} and ${MAX_VALUE} mg/dl.`;

/**
 * Validates the *shape* of a reading (no database needed).
 * Returns { errors, data } where errors is { field: message } and data is the cleaned input.
 * Rules that need the database (one per slot, max 4 per day) live in the readings route.
 */
function validateReadingInput(input, today) {
  const errors = {};
  const data = {};
  const { value, date, slot } = input || {};

  // --- value ---
  const isEmpty = value === undefined || value === null || String(value).trim() === '';
  if (isEmpty) {
    errors.value = 'Please enter a glucose value.';
  } else {
    // Accept 120 or "120" but not 120.5, "12a" or "1e2".
    const text = String(value).trim();
    const number = /^-?\d+$/.test(text) ? Number(text) : NaN;
    if (!Number.isInteger(number) || number < MIN_VALUE || number > MAX_VALUE) {
      errors.value = VALUE_RANGE_MESSAGE;
    } else {
      data.value = number;
    }
  }

  // --- date ---
  if (!date) {
    errors.date = 'Please select a date.';
  } else if (!isValidDateString(date)) {
    errors.date = 'Please enter a valid date (YYYY-MM-DD).';
  } else if (isFutureDate(date, today)) {
    errors.date = 'Date cannot be in the future.';
  } else {
    data.date = date;
  }

  // --- slot ---
  if (!slot) {
    errors.slot = 'Please select a time slot.';
  } else if (!SLOT_VALUES.includes(slot)) {
    errors.slot = 'Please select a valid time slot.';
  } else {
    data.slot = slot;
  }

  return { errors, data };
}

function validateSignup({ name, email, password } = {}) {
  const errors = {};
  const data = {};

  if (!name || !String(name).trim()) errors.name = 'Please enter your name.';
  else if (String(name).trim().length > 100) errors.name = 'Name is too long (max 100 characters).';
  else data.name = String(name).trim();

  if (!email || !String(email).trim()) errors.email = 'Please enter your email.';
  else if (!EMAIL_RE.test(String(email).trim())) errors.email = 'Please enter a valid email address.';
  else data.email = String(email).trim().toLowerCase();

  if (!password) errors.password = 'Please enter a password.';
  else if (String(password).length < 8) errors.password = 'Password must be at least 8 characters.';
  else if (String(password).length > 72) errors.password = 'Password must be at most 72 characters.'; // bcrypt limit
  else data.password = String(password);

  return { errors, data };
}

module.exports = { validateReadingInput, validateSignup, VALUE_RANGE_MESSAGE };
