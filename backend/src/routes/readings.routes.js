const router = require('express').Router();
const controller = require('../controllers/readings.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth); // every reading route needs a logged-in user

router.get('/', controller.list);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
