const config = require('../config');
const { isValidDateString, todayInTimezone } = require('../utils/dates');
const { SLOT_VALUES, MIN_VALUE, MAX_VALUE } = require('../utils/slots');
const { Joi, dateString, wholeNumber, parseId } = require('./common');
const { validate } = require('./validate');

const VALUE_RANGE_MESSAGE = `Value must be between ${MIN_VALUE} and ${MAX_VALUE} mg/dl.`;
const SLOT_REQUIRED = 'Please select a time slot.';
const SLOT_INVALID = 'Please select a valid time slot.';
const DATE_INVALID = 'Please enter a valid date (YYYY-MM-DD).';

const slotField = Joi.string().empty('').valid(...SLOT_VALUES);

/** Body of POST /api/readings and PUT /api/readings/:id */
const readingSchema = Joi.object({
  value: wholeNumber({
    min: MIN_VALUE,
    max: MAX_VALUE,
    message: VALUE_RANGE_MESSAGE,
    required: 'Please enter a glucose value.',
  }).required(),
  date: dateString({ required: 'Please select a date.', invalid: DATE_INVALID }).required(),
  slot: slotField.required().messages({
    'any.required': SLOT_REQUIRED,
    'any.only': SLOT_INVALID,
    'string.base': SLOT_INVALID,
  }),
});

/** Query of GET /api/readings: ?date=&slot=&page=&limit= */
const listQuerySchema = Joi.object({
  date: Joi.string()
    .empty('')
    .custom((value, helpers) => (isValidDateString(value) ? value : helpers.error('date.invalid')))
    .messages({ 'date.invalid': DATE_INVALID, 'string.base': DATE_INVALID }),
  slot: slotField.messages({ 'any.only': SLOT_INVALID, 'string.base': SLOT_INVALID }),
  // Paging is forgiving: junk falls back to the defaults, and limit is capped at 100.
  page: Joi.any().custom((v) => Math.max(parseInt(v, 10) || 1, 1)).default(1),
  limit: Joi.any().custom((v) => Math.min(Math.max(parseInt(v, 10) || 20, 1), 100)).default(20),
});

/** Someone else's (or a nonsense) id looks exactly like a missing one: 404. */
const validateReadingId = (raw) => parseId(raw, 'Reading not found.');

module.exports = {
  VALUE_RANGE_MESSAGE,
  readingSchema,
  listQuerySchema,
  validateReading: (body, today) => validate(readingSchema, body, { today: today ?? todayInTimezone(config.timezone) }),
  validateListQuery: (query) => validate(listQuerySchema, query),
  validateReadingId,
};
