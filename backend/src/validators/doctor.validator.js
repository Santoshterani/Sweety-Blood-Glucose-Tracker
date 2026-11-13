const { parseId } = require('./common');

/** Someone else's (or a nonsense) patient id looks exactly like a missing one: 404. */
const validatePatientId = (raw) => parseId(raw, 'Patient not found.');

module.exports = { validatePatientId };
