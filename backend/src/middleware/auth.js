const jwt = require('jsonwebtoken');
const config = require('../config');
const { HttpError } = require('../utils/httpError');
const { ROLES } = require('../utils/roles');

/** Requires "Authorization: Bearer <token>". Puts the logged-in user's id and role on req.user. */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new HttpError(401, 'Please log in to continue.'));
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    // Tokens issued before roles existed have no role claim: those users are patients.
    req.user = { id: Number(payload.sub), role: payload.role || ROLES.PATIENT };
    next();
  } catch {
    next(new HttpError(401, 'Your session has expired. Please log in again.'));
  }
}

/** Use after requireAuth: only the listed roles may continue. */
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new HttpError(403, 'You do not have access to this.'));
  }
  next();
};

module.exports = { requireAuth, requireRole };
