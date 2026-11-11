/**
 * An error we throw on purpose, with the HTTP status to send back.
 * `errors` is an optional { field: message } map so the UI can show the message next to the right input.
 */
class HttpError extends Error {
  constructor(status, message, errors) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

/** 400 built from a { field: message } map. The top-level `error` is the first message. */
function validationError(errors) {
  return new HttpError(400, Object.values(errors)[0], errors);
}

module.exports = { HttpError, validationError };
