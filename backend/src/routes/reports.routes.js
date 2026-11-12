const router = require('express').Router();
const controller = require('../controllers/reports.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// Declared before '/:type' so "pdf" isn't read as a report type.
router.get('/pdf', controller.pdf);
router.get('/:type', controller.get);

module.exports = router;
