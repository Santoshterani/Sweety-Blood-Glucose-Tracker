const config = require('../config');
const { HttpError } = require('../utils/httpError');
const { isValidDateString, isFutureDate, diffDays, todayInTimezone } = require('../utils/dates');
const { Joi, dateString } = require('./common');
const { validate } = require('./validate');

const REPORT_TYPES = ['daily', 'weekly', 'monthly', 'yearly', 'month-to-date', 'custom'];
const RANGE_REPORT_TYPES = ['weekly', 'monthly', 'yearly'];
const MAX_CUSTOM_DAYS = 1827; // about 5 years

const DATE_INVALID = 'Please enter a valid date (YYYY-MM-DD).';

/** ?date=YYYY-MM-DD (defaults to today). Must be a real date and not in the future. Also used by the dashboard. */
const selectedDateSchema = Joi.object({
  date: dateString({ required: DATE_INVALID, invalid: DATE_INVALID }).default(Joi.ref('$today')),
});

/** Date range: ?from=&to= — both required, real dates, not in the future, from <= to, at most ~5 years. */
const customRangeSchema = Joi.object({
  from: dateString({ required: 'Please select a start date.', invalid: 'Please enter a valid start date (YYYY-MM-DD).' }).required(),
  to: dateString({ required: 'Please select an end date.', invalid: 'Please enter a valid end date (YYYY-MM-DD).' })
    .required()
    .custom((to, helpers) => {
      const from = helpers.state.ancestors[0].from;
      // Only compare when the start date itself is fine (otherwise its own message is shown).
      if (!isValidDateString(from) || isFutureDate(from, helpers.prefs.context.today)) return to;
      if (from > to) return helpers.message({ custom: 'End date must be on or after the start date.' });
      if (diffDays(from, to) + 1 > MAX_CUSTOM_DAYS) return helpers.message({ custom: 'Date range cannot be longer than 5 years.' });
      return to;
    }),
});

const today = () => todayInTimezone(config.timezone);
const validateSelectedDate = (query) => validate(selectedDateSchema, query, { today: today() }).date;
const validateCustomRange = (query) => validate(customRangeSchema, query, { today: today() });

function validateReportType(type) {
  if (!REPORT_TYPES.includes(type)) throw new HttpError(404, 'Report type not found.');
  return type;
}

function validateReportParams(type, query) {
  const hasRange = query.from !== undefined || query.to !== undefined;
  if (type === 'custom' || (RANGE_REPORT_TYPES.includes(type) && hasRange)) {
    return validateCustomRange(query);
  }
  return { date: validateSelectedDate(query) };
}

module.exports = {
  REPORT_TYPES,
  MAX_CUSTOM_DAYS,
  selectedDateSchema,
  customRangeSchema,
  validateReportType,
  validateSelectedDate,
  validateCustomRange,
  validateReportParams,
};
