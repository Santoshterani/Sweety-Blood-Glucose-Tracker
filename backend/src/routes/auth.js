const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { HttpError, validationError } = require('../utils/httpError');
const { validateSignup } = require('../utils/validation');

const router = express.Router();

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 10;

const publicUser = (row) => ({ id: row.id, name: row.name, email: row.email });

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
    const result = await db.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [data.name, data.email, passwordHash]
    );
    user = result.rows[0];
  } catch (err) {
    if (err.code === '23505') {
      // unique violation on email
      throw new HttpError(409, 'An account with this email already exists.', {
        email: 'An account with this email already exists.',
      });
    }
    throw err;
  }

  res.status(201).json({ token: signToken(user.id), user: publicUser(user) });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  const errors = {};
  if (!email || !String(email).trim()) errors.email = 'Please enter your email.';
  if (!password) errors.password = 'Please enter your password.';
  if (Object.keys(errors).length) throw validationError(errors);

  const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [String(email).trim().toLowerCase()]);
  const user = rows[0];

  // Same message for "no such user" and "wrong password" so we don't reveal which emails exist.
  const passwordOk = user && (await bcrypt.compare(String(password), user.password_hash));
  if (!passwordOk) throw new HttpError(401, 'Invalid email or password.');

  res.json({ token: signToken(user.id), user: publicUser(user) });
});

// GET /api/auth/me  - lets the frontend restore the session from a saved token
router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await db.query('SELECT id, name, email FROM users WHERE id = $1', [req.user.id]);
  if (!rows[0]) throw new HttpError(401, 'Your session has expired. Please log in again.');
  res.json({ user: publicUser(rows[0]) });
});

module.exports = router;
