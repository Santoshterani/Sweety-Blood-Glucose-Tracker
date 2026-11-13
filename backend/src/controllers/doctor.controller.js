const doctorService = require('../services/doctor.service');
const { validatePatientId } = require('../validators/doctor.validator');
const { validateReportType, validateReportParams } = require('../validators/reports.validator');

/** Same report rules as a patient's own reports. */
function parseReport(type, query) {
  validateReportType(type);
  return validateReportParams(type, query);
}

// GET /api/doctor/patients
const listPatients = async (req, res) => {
  res.json(await doctorService.listPatients(req.user.id));
};

// GET /api/doctor/patients/:id
const getPatient = async (req, res) => {
  res.json({ patient: await doctorService.getPatient(req.user.id, validatePatientId(req.params.id)) });
};

// GET /api/doctor/patients/:id/reports/:type
const getReport = async (req, res) => {
  const patientId = validatePatientId(req.params.id);
  const { type } = req.params;
  res.json(await doctorService.getPatientReport(req.user.id, patientId, type, parseReport(type, req.query)));
};

// GET /api/doctor/patients/:id/reports/pdf?type=weekly&date=...
const getReportPdf = async (req, res) => {
  const patientId = validatePatientId(req.params.id);
  const type = req.query.type || 'daily';
  const { pdf, filename } = await doctorService.getPatientReportPdf(req.user.id, patientId, type, parseReport(type, req.query));

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', pdf.length);
  res.send(pdf);
};

module.exports = { listPatients, getPatient, getReport, getReportPdf };
