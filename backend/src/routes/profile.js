const express = require('express');
const config = require('../config');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { HttpError, validationError } = require('../utils/httpError');
const { validateProfile } = require('../utils/validation');
const { todayInTimezone } = require('../utils/dates');
const { toProfile } = require('../utils/profile');

const router = express.Router();
router.use(requireAuth);

async function loadUser(id) {
  const { rows } = await db.query('SELECT * FROM users WHERE id = ?', [id]);
  if (!rows[0]) throw new HttpError(401, 'Your session has expired. Please log in again.');
  return rows[0];
}

// GET /api/profile
router.get('/', async (req, res) => {
  res.json({ profile: toProfile(await loadUser(req.user.id)) });
});

// PUT /api/profile  - saves the whole form
router.put('/', async (req, res) => {
  const { errors, data } = validateProfile(req.body, todayInTimezone(config.timezone));
  if (Object.keys(errors).length) throw validationError(errors);

  try {
    await db.query(
      `UPDATE users SET
         name = ?, email = ?, phone = ?, date_of_birth = ?, sex = ?, height_cm = ?, weight_kg = ?,
         diabetes_type = ?, diagnosed_year = ?, medication = ?, target_low = ?, target_high = ?,
         doctor_name = ?, doctor_phone = ?, emergency_contact = ?
       WHERE id = ?`,
      [
        data.name, data.email, data.phone, data.dateOfBirth, data.sex, data.heightCm, data.weightKg,
        data.diabetesType, data.diagnosedYear, data.medication, data.targetLow, data.targetHigh,
        data.doctorName, data.doctorPhone, data.emergencyContact,
        req.user.id,
      ]
    );
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new HttpError(409, 'An account with this email already exists.', {
        email: 'An account with this email already exists.',
      });
    }
    throw err;
  }

  res.json({ profile: toProfile(await loadUser(req.user.id)) });
});

module.exports = router;
