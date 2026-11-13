const router = require('express').Router();
const controller = require('../controllers/reminders.controller');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ROLES } = require('../utils/roles');

router.use(requireAuth, requireRole(ROLES.PATIENT));

router.get('/', controller.list);

module.exports = router;
