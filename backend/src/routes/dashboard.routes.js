const router = require('express').Router();
const controller = require('../controllers/dashboard.controller');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ROLES } = require('../utils/roles');

router.use(requireAuth, requireRole(ROLES.PATIENT)); // a patient's own data

router.get('/', controller.get);

module.exports = router;
