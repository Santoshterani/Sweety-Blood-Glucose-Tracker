const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { HttpError, validationError } = require('../utils/httpError');
const { validateSignup } = require('../utils/validation');
const { toProfile } = require('../utils/profile');

const router = express.Router();

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 10;

function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const { errors, data } = validateSignup(req.body);
  if (Object.keys(errors).length) throw validationError(errors);

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

  let user;
  try {
    const result = await db.query('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [
      data.name,
      data.email,
      passwordHash,
    ]);
    const created = await db.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
    user = created.rows[0];
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      // unique violation on email
      throw new HttpError(409, 'An account with this email already exists.', {
        email: 'An account with this email already exists.',
      });
    }
    throw err;
  }

  res.status(201).json({ token: signToken(user.id), user: toProfile(user) });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  const errors = {};
  if (!email || !String(email).trim()) errors.email = 'Please enter your email.';
  if (!password) errors.password = 'Please enter your password.';
  if (Object.keys(errors).length) throw validationError(errors);

  const { rows } = await db.query('SELECT * FROM users WHERE email = ?', [String(email).trim().toLowerCase()]);
  const user = rows[0];

  // Same message for "no such user" and "wrong password" so we don't reveal which emails exist.
  const passwordOk = user && (await bcrypt.compare(String(password), user.password_hash));
  if (!passwordOk) throw new HttpError(401, 'Invalid email or password.');

  res.json({ token: signToken(user.id), user: toProfile(user) });
});

// GET /api/auth/me  - lets the frontend restore the session from a saved token
router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!rows[0]) throw new HttpError(401, 'Your session has expired. Please log in again.');
  res.json({ user: toProfile(rows[0]) });
});

module.exports = router;
