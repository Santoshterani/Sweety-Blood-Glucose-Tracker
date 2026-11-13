const { Joi, EMAIL_RE } = require('./common');
const { ROLE_VALUES, ROLES } = require('../utils/roles');
const { validate } = require('./validate');

const text = (requiredMessage) => ({ 'any.required': requiredMessage, 'string.empty': requiredMessage, 'string.base': requiredMessage });

const signupSchema = Joi.object({
  name: Joi.string().trim().max(100).required().messages({
    ...text('Please enter your name.'),
    'string.max': 'Name is too long (max 100 characters).',
  }),
  email: Joi.string().trim().lowercase().pattern(EMAIL_RE).required().messages({
    ...text('Please enter your email.'),
    'string.pattern.base': 'Please enter a valid email address.',
  }),
  password: Joi.string().min(8).max(72).required().messages({
    ...text('Please enter a password.'),
    'string.min': 'Password must be at least 8 characters.',
    'string.max': 'Password must be at most 72 characters.', // bcrypt limit
  }),
  // Who is signing up. Optional: the default is a patient.
  role: Joi.string().valid(...ROLE_VALUES).default(ROLES.PATIENT).messages({
    'any.only': 'Please choose a valid account type.',
    'string.base': 'Please choose a valid account type.',
  }),
});

const loginSchema = Joi.object({
  email: Joi.string().trim().lowercase().required().messages(text('Please enter your email.')),
  password: Joi.string().required().messages(text('Please enter your password.')),
});

module.exports = {
  signupSchema,
  loginSchema,
  validateSignup: (body) => validate(signupSchema, body),
  validateLogin: (body) => validate(loginSchema, body),
};
