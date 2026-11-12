const router = require('express').Router();
const controller = require('../controllers/dashboard.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', controller.get);

module.exports = router;
