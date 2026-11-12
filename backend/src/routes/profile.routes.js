const router = require('express').Router();
const controller = require('../controllers/profile.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', controller.get);
router.put('/', controller.update);

module.exports = router;
