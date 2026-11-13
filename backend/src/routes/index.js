const router = require('express').Router();
const { SLOTS } = require('../utils/slots');

router.get('/health', (req, res) => res.json({ status: 'ok' }));

// Lets the frontend build its dropdown from one source of truth.
router.get('/slots', (req, res) => res.json({ slots: SLOTS }));

router.use('/auth', require('./auth.routes'));
router.use('/readings', require('./readings.routes'));
router.use('/reports', require('./reports.routes'));
router.use('/profile', require('./profile.routes'));
router.use('/dashboard', require('./dashboard.routes'));
router.use('/reminders', require('./reminders.routes'));
router.use('/doctors', require('./doctors.routes'));
router.use('/doctor', require('./doctor.routes'));

module.exports = router;
