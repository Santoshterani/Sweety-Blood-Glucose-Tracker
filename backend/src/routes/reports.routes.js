const router = require('express').Router();
const controller = require('../controllers/reports.controller');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ROLES } = require('../utils/roles');

router.use(requireAuth, requireRole(ROLES.PATIENT)); // a patient's own data

// Declared before '/:type' so "pdf" isn't read as a report type.
router.get('/pdf', controller.pdf);
router.get('/:type', controller.get);

module.exports = router;
