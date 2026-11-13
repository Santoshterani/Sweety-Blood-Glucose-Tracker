const { MIN_VALUE, MAX_VALUE } = require('../utils/slots');
const { ROLES } = require('../utils/roles');
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
const phoneSchema = Joi.string()
  .trim()
  .pattern(PHONE_RE)
  .custom((value, helpers) => {
    const digits = value.replace(/\D/g, '');
    if (!digits) return helpers.error('phone.digits');
    if (/^0+$/.test(digits)) return helpers.error('phone.allZero');
    return value;
  })
  .messages({
    'string.pattern.base': 'Please enter a valid phone number.',
    'string.base': 'Please enter a valid phone number.',
    'phone.digits': 'Please enter a valid phone number.',
    'phone.allZero': 'Phone number cannot contain only zeros.',
  });
const optionalPhone = optional(phoneSchema);
const optionalNumber = (options) => optional(wholeNumber(options));
const requiredPhone = phoneSchema.empty(BLANK).required().messages({
  ...required('Please enter your phone number.'),
  'string.pattern.base': 'Please enter a valid phone number.',
  'phone.digits': 'Please enter a valid phone number.',
  'phone.allZero': 'Phone number cannot contain only zeros.',
});
const requiredDateOfBirth = dateString({
  required: 'Please enter your date of birth.',
  invalid: 'Please enter a valid date of birth.',
  future: 'Date of birth cannot be in the future.',
  min: '1900-01-01',
})
  .empty(BLANK)
  .required();
const requiredSex = Joi.string()
  .valid(...SEX_OPTIONS)
  .empty(BLANK)
  .required()
  .messages({
    ...required('Please choose an option.'),
    'any.only': 'Please choose a valid option.',
  });
const requiredNumber = (options) => wholeNumber(options).empty(BLANK).required();
const requiredMedication = Joi.string().trim().max(255).empty(BLANK).required().messages({
  ...required('Please enter your medication.'),
  'string.max': 'Please keep this under 255 characters.',
});

/** Common fields for PUT /api/profile. Patient health details are required below. */
const profileSchema = Joi.object({
  name: Joi.string().trim().max(100).required().messages({
    ...required('Please enter your name.'),
    'string.max': 'Name is too long (max 100 characters).',
  }),
  email: Joi.string().trim().lowercase().pattern(EMAIL_RE).required().messages({
    ...required('Please enter your email.'),
    'string.pattern.base': 'Please enter a valid email address.',
  }),
  phone: requiredPhone,
  dateOfBirth: requiredDateOfBirth,
  sex: requiredSex,
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
  // The registered doctor who may see this patient's reports (blank = nobody).
  doctorId: optional(Joi.number().integer().min(1).max(2147483647)).messages({
    'number.base': 'Please choose a valid doctor.',
    'number.integer': 'Please choose a valid doctor.',
    'number.min': 'Please choose a valid doctor.',
    'number.max': 'Please choose a valid doctor.',
  }),
  doctorName: optionalText(100),
  doctorPhone: optionalPhone,
  emergencyContact: optionalText(255),
});

const patientProfileSchema = profileSchema.keys({
  heightCm: requiredNumber({
    min: 50,
    max: 260,
    message: 'Height must be between 50 and 260 cm.',
    required: 'Please enter your height.',
  }),
  weightKg: requiredNumber({
    min: 10,
    max: 400,
    allowDecimal: true,
    message: 'Weight must be between 10 and 400 kg.',
    required: 'Please enter your weight.',
  }),
  diabetesType: Joi.string()
    .valid(...DIABETES_TYPES)
    .empty(BLANK)
    .required()
    .messages({
      ...required('Please select your diabetes type.'),
      'any.only': 'Please choose a valid diabetes type.',
    }),
  diagnosedYear: Joi.any()
    .empty(BLANK)
    .required()
    .custom((value, helpers) => {
      const thisYear = Number(helpers.prefs.context.today.slice(0, 4));
      const text = String(value).trim();
      const n = /^\d+$/.test(text) ? Number(text) : NaN;
      return n >= 1900 && n <= thisYear ? n : helpers.message({ custom: `Year must be between 1900 and ${thisYear}.` });
    })
    .messages({ 'any.required': 'Please enter the year diagnosed.' }),
  medication: requiredMedication,
});

module.exports = {
  profileSchema: patientProfileSchema,
  validateProfile: (body, today, role = 'patient') =>
    validate(role === ROLES.DOCTOR ? profileSchema : patientProfileSchema, body, { today }),
};
