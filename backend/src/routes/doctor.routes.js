const router = require('express').Router();
const controller = require('../controllers/doctor.controller');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ROLES } = require('../utils/roles');

// Everything here is for doctor accounts only.
router.use(requireAuth, requireRole(ROLES.DOCTOR));

router.get('/patients', controller.listPatients);
router.get('/patients/:id', controller.getPatient);
// Declared before '/:type' so "pdf" isn't read as a report type.
router.get('/patients/:id/reports/pdf', controller.getReportPdf);
router.get('/patients/:id/reports/:type', controller.getReport);

module.exports = router;
