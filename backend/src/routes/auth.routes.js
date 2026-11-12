const router = require('express').Router();
const controller = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth');

router.post('/signup', controller.signup);
router.post('/login', controller.login);
router.get('/me', requireAuth, controller.me);

module.exports = router;
