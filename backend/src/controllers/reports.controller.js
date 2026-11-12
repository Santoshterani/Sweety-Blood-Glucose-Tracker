const reportsService = require('../services/reports.service');
const { validateReportType, validateSelectedDate, validateCustomRange } = require('../validators/reports.validator');

/** Validates the type and the query that goes with it: ?date= for presets, ?from=&to= for custom. */
function parse(type, query) {
  validateReportType(type);
  return type === 'custom' ? validateCustomRange(query) : { date: validateSelectedDate(query) };
}

// GET /api/reports/:type   type = daily | weekly | monthly | yearly | month-to-date | custom
//   daily          ?date=             that day, plus each reading with its slot
//   weekly         ?date=             the 7 days ending on that date
//   monthly        ?date=             the whole previous month
//   yearly         ?date=             1 Jan -> that date
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
