const { validationError } = require('../utils/httpError');

/**
 * Runs a Joi schema over `input`.
 *  - every problem is reported at once, as { field: firstMessage }
 *  - unknown keys are dropped
 *  - on success returns the cleaned value (trimmed, lower-cased, numbers as numbers, defaults filled in)
 *  - on failure throws a 400 HttpError carrying the { field: message } map
 * `context` is available to the schema as `$name` (e.g. `$today`).
 */
function validate(schema, input, context = {}) {
  const { error, value } = schema.validate(input ?? {}, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
    context,
    errors: { wrap: { label: false } },
  });
  if (!error) return value;

  const errors = {};
  for (const detail of error.details) {
    const field = detail.path.length ? String(detail.path[0]) : '_';
    if (!(field in errors)) errors[field] = detail.message;
  }
  throw validationError(errors);
}

module.exports = { validate };
