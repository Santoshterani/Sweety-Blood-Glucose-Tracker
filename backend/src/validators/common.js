// Small reusable Joi building blocks shared by the validators.
const Joi = require('joi');
const { isValidDateString, isFutureDate } = require('../utils/dates');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+()\-\s]{6,30}$/;

// What counts as "left empty": '', null, or only spaces.
const BLANK = Joi.alternatives(Joi.valid('', null), Joi.string().trim().max(0));

/**
 * A 'YYYY-MM-DD' string that must be a real calendar date.
 * Pass `allowFuture: false` to also reject dates after `$today` (given as validation context).
 */
function dateString({ required, invalid, future = 'Date cannot be in the future.', allowFuture = false, min }) {
  return Joi.string()
    .empty('')
    .custom((value, helpers) => {
      if (!isValidDateString(value)) return helpers.error('date.invalid');
      if (!allowFuture && isFutureDate(value, helpers.prefs.context.today)) return helpers.error('date.future');
      if (min && value < min) return helpers.error('date.invalid');
      return value;
    })
    .messages({
      'any.required': required,
      'string.base': invalid,
      'date.invalid': invalid,
      'date.future': future,
    });
}

/** A whole number, written as 120 or "120" (not 120.5, "12a" or "1e2"). */
function wholeNumber({ min, max, message, required, allowDecimal = false }) {
  const pattern = allowDecimal ? /^\d+(\.\d)?$/ : /^-?\d+$/;
  return Joi.any()
    .custom((value, helpers) => {
      const text = String(value).trim();
      if (value === null || text === '') return helpers.error('any.required');
      const number = pattern.test(text) ? Number(text) : NaN;
      if (!(number >= min && number <= max)) return helpers.error('number.range');
      if (!allowDecimal && !Number.isInteger(number)) return helpers.error('number.range');
      return number;
    })
    .messages({ 'any.required': required || message, 'number.range': message });
}

module.exports = { Joi, EMAIL_RE, PHONE_RE, BLANK, dateString, wholeNumber };
