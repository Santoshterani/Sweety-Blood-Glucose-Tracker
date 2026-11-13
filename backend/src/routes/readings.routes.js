const router = require('express').Router();
const controller = require('../controllers/readings.controller');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ROLES } = require('../utils/roles');

router.use(requireAuth, requireRole(ROLES.PATIENT)); // readings belong to patients

router.get('/', controller.list);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
