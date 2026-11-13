const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { isUniqueViolation } = require('../db');
const userRepository = require('../repositories/user.repository');
const { HttpError } = require('../utils/httpError');
const { toProfile } = require('../utils/profile');

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 10;
const SESSION_EXPIRED = 'Your session has expired. Please log in again.';

const signToken = (user) =>
  jwt.sign({ sub: String(user.id), role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

async function signup({ name, email, password, role }) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  let user;
  try {
    user = await userRepository.create({ name, email, passwordHash, role });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new HttpError(409, 'An account with this email already exists.', {
        email: 'An account with this email already exists.',
      });
    }
    throw err;
  }
  return { token: signToken(user), user: toProfile(user) };
}

async function login({ email, password }) {
  const user = await userRepository.findByEmail(email);

  // Same message for "no such user" and "wrong password" so we don't reveal which emails exist.
  const passwordOk = user && (await bcrypt.compare(password, user.password_hash));
  if (!passwordOk) throw new HttpError(401, 'Invalid email or password.');

  return { token: signToken(user), user: toProfile(user) };
}

/** Lets the frontend restore the session from a saved token. */
async function getCurrentUser(userId) {
  const user = await userRepository.findById(userId);
  if (!user) throw new HttpError(401, SESSION_EXPIRED);
  return toProfile(user);
}

module.exports = { signup, login, getCurrentUser };
