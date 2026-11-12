const { MIN_VALUE, MAX_VALUE } = require('../utils/slots');
const { Joi, EMAIL_RE, PHONE_RE, BLANK, dateString, wholeNumber } = require('./common');
const { validate } = require('./validate');

const SEX_OPTIONS = ['Female', 'Male', 'Other'];
const DIABETES_TYPES = ['Type 1', 'Type 2', 'Gestational', 'Other'];
const TARGET_MESSAGE = `Must be a whole number between ${MIN_VALUE} and ${MAX_VALUE}.`;

const required = (message) => ({ 'any.required': message, 'string.empty': message, 'string.base': message });

/** An optional field: left empty (or only spaces) it becomes null. */
const optional = (schema) => schema.empty(BLANK).default(null);
const optionalText = (max) =>
  optional(Joi.string().trim().max(max)).messages({
    'string.max': `Please keep this under ${max} characters.`,
    'string.base': `Please keep this under ${max} characters.`,
  });
const optionalPhone = optional(Joi.string().trim().pattern(PHONE_RE)).messages({
  'string.pattern.base': 'Please enter a valid phone number.',
  'string.base': 'Please enter a valid phone number.',
});
const optionalNumber = (options) => optional(wholeNumber(options));

/** Body of PUT /api/profile. Everything except name and email is optional. */
const profileSchema = Joi.object({
  name: Joi.string().trim().max(100).required().messages({
    ...required('Please enter your name.'),
    'string.max': 'Name is too long (max 100 characters).',
  }),
  email: Joi.string().trim().lowercase().pattern(EMAIL_RE).required().messages({
    ...required('Please enter your email.'),
    'string.pattern.base': 'Please enter a valid email address.',
  }),
  phone: optionalPhone,
  dateOfBirth: optional(
    dateString({ required: 'Please enter a valid date of birth.', invalid: 'Please enter a valid date of birth.', future: 'Date of birth cannot be in the future.', min: '1900-01-01' })
  ),
  sex: optional(Joi.string().valid(...SEX_OPTIONS)).messages({ 'any.only': 'Please choose a valid option.', 'string.base': 'Please choose a valid option.' }),
  heightCm: optionalNumber({ min: 50, max: 260, message: 'Height must be between 50 and 260 cm.' }),
  weightKg: optionalNumber({ min: 10, max: 400, allowDecimal: true, message: 'Weight must be between 10 and 400 kg.' }),
  diabetesType: optional(Joi.string().valid(...DIABETES_TYPES)).messages({
    'any.only': 'Please choose a valid diabetes type.',
    'string.base': 'Please choose a valid diabetes type.',
  }),
  diagnosedYear: Joi.any()
    .empty(BLANK)
    .default(null)
    .custom((value, helpers) => {
      const thisYear = Number(helpers.prefs.context.today.slice(0, 4));
      const text = String(value).trim();
      const n = /^\d+$/.test(text) ? Number(text) : NaN;
      return n >= 1900 && n <= thisYear ? n : helpers.message({ custom: `Year must be between 1900 and ${thisYear}.` });
    }),
  medication: optionalText(255),
  targetLow: wholeNumber({ min: MIN_VALUE, max: MAX_VALUE, message: TARGET_MESSAGE }).empty(BLANK).default(70),
  targetHigh: wholeNumber({ min: MIN_VALUE, max: MAX_VALUE, message: TARGET_MESSAGE })
    .empty(BLANK)
    .default(180)
    .custom((value, helpers) => {
      const low = helpers.state.ancestors[0].targetLow; // already converted to a number when valid
      return typeof low === 'number' && low >= value ? helpers.message({ custom: 'Target high must be greater than target low.' }) : value;
    }),
  doctorName: optionalText(100),
  doctorPhone: optionalPhone,
  emergencyContact: optionalText(255),
});

module.exports = {
  profileSchema,
  validateProfile: (body, today) => validate(profileSchema, body, { today }),
};
