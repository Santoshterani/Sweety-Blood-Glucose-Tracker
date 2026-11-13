const reportsService = require('../services/reports.service');
const { validateReportType, validateReportParams } = require('../validators/reports.validator');

/** Presets accept ?date= for compatibility; selectable periods accept ?from=&to=. */
function parse(type, query) {
  validateReportType(type);
  return validateReportParams(type, query);
}

// GET /api/reports/:type   type = daily | weekly | monthly | yearly | month-to-date | custom
//   daily          ?date=             that day, plus each reading with its slot
//   weekly         ?from=&to=          the selected date range
//   monthly        ?from=&to=          the selected month
//   yearly         ?from=&to=          the selected year
//   month-to-date  ?date=             1st of the month -> that date
//   custom         ?from=&to=         any range you choose
const get = async (req, res) => {
  const { type } = req.params;
  res.json(await reportsService.getReport(req.user.id, type, parse(type, req.query)));
};

// GET /api/reports/pdf?type=weekly&date=2026-11-11   (or type=custom&from=&to=)
const pdf = async (req, res) => {
  const type = req.query.type || 'daily';
  const { pdf: file, filename } = await reportsService.getReportPdf(req.user.id, type, parse(type, req.query));

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', file.length);
  res.send(file);
};

module.exports = { get, pdf };
