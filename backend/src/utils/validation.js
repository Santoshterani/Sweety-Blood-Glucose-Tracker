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

const SEX_OPTIONS = ['Female', 'Male', 'Other'];
const DIABETES_TYPES = ['Type 1', 'Type 2', 'Gestational', 'Other'];
const PHONE_RE = /^[0-9+()\-\s]{6,30}$/;

const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';

/**
 * Validates the patient profile form. Everything except name and email is optional;
 * empty optional fields come back as null. The target range falls back to 70-180.
 */
function validateProfile(input, today) {
  const errors = {};
  const data = {};
  const body = input || {};

  // --- name & email (required) ---
  if (isBlank(body.name)) errors.name = 'Please enter your name.';
  else if (String(body.name).trim().length > 100) errors.name = 'Name is too long (max 100 characters).';
  else data.name = String(body.name).trim();

  if (isBlank(body.email)) errors.email = 'Please enter your email.';
  else if (!EMAIL_RE.test(String(body.email).trim())) errors.email = 'Please enter a valid email address.';
  else data.email = String(body.email).trim().toLowerCase();

  // --- optional phone numbers ---
  for (const [field, label] of [['phone', 'phone number'], ['doctorPhone', 'phone number']]) {
    if (isBlank(body[field])) data[field] = null;
    else if (!PHONE_RE.test(String(body[field]).trim())) errors[field] = `Please enter a valid ${label}.`;
    else data[field] = String(body[field]).trim();
  }

  // --- optional date of birth ---
  if (isBlank(body.dateOfBirth)) data.dateOfBirth = null;
  else if (!isValidDateString(body.dateOfBirth)) errors.dateOfBirth = 'Please enter a valid date of birth.';
  else if (isFutureDate(body.dateOfBirth, today)) errors.dateOfBirth = 'Date of birth cannot be in the future.';
  else if (body.dateOfBirth < '1900-01-01') errors.dateOfBirth = 'Please enter a valid date of birth.';
  else data.dateOfBirth = body.dateOfBirth;

  // --- optional pick-lists ---
  if (isBlank(body.sex)) data.sex = null;
  else if (!SEX_OPTIONS.includes(body.sex)) errors.sex = 'Please choose a valid option.';
  else data.sex = body.sex;

  if (isBlank(body.diabetesType)) data.diabetesType = null;
  else if (!DIABETES_TYPES.includes(body.diabetesType)) errors.diabetesType = 'Please choose a valid diabetes type.';
  else data.diabetesType = body.diabetesType;

  // --- optional numbers ---
  const intField = (field, min, max, message) => {
    if (isBlank(body[field])) {
      data[field] = null;
      return;
    }
    const text = String(body[field]).trim();
    const n = /^\d+$/.test(text) ? Number(text) : NaN;
    if (!Number.isInteger(n) || n < min || n > max) errors[field] = message;
    else data[field] = n;
  };
  intField('heightCm', 50, 260, 'Height must be between 50 and 260 cm.');
  intField('diagnosedYear', 1900, Number(today.slice(0, 4)), `Year must be between 1900 and ${today.slice(0, 4)}.`);

  if (isBlank(body.weightKg)) data.weightKg = null;
  else {
    const text = String(body.weightKg).trim();
    const n = /^\d+(\.\d)?$/.test(text) ? Number(text) : NaN;
    if (!(n >= 10 && n <= 400)) errors.weightKg = 'Weight must be between 10 and 400 kg.';
    else data.weightKg = n;
  }

  // --- optional text ---
  for (const [field, max] of [['medication', 255], ['doctorName', 100], ['emergencyContact', 255]]) {
    if (isBlank(body[field])) data[field] = null;
    else if (String(body[field]).trim().length > max) errors[field] = `Please keep this under ${max} characters.`;
    else data[field] = String(body[field]).trim();
  }

  // --- target range (defaults 70-180) ---
  const targetRangeMessage = `Must be a whole number between ${MIN_VALUE} and ${MAX_VALUE}.`;
  const target = (field, fallback) => {
    if (isBlank(body[field])) return fallback;
    const text = String(body[field]).trim();
    const n = /^\d+$/.test(text) ? Number(text) : NaN;
    if (!Number.isInteger(n) || n < MIN_VALUE || n > MAX_VALUE) {
      errors[field] = targetRangeMessage;
      return null;
    }
    return n;
  };
  const low = target('targetLow', 70);
  const high = target('targetHigh', 180);
  if (low !== null && high !== null && low >= high) errors.targetHigh = 'Target high must be greater than target low.';
  if (!errors.targetLow && !errors.targetHigh) {
    data.targetLow = low;
    data.targetHigh = high;
  }

  return { errors, data };
}

module.exports = { validateReadingInput, validateSignup, validateProfile, VALUE_RANGE_MESSAGE };
