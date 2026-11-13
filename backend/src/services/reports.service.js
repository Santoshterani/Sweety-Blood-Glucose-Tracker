const config = require('../config');
const userRepository = require('../repositories/user.repository');
const readingRepository = require('../repositories/reading.repository');
const { HttpError } = require('../utils/httpError');
const { todayInTimezone, monthToDateRange, previousMonthRange, lastSevenDaysRange, yearToDateRange } = require('../utils/dates');
const { buildReport } = require('../utils/reportBuilder');
const { renderReportPdf } = require('../utils/pdfReport');
const { toProfile } = require('../utils/profile');

/**
 * Turns a report type into the date range it covers.
 * `params` is { date } for legacy presets, or { from, to } for selected periods and custom ranges.
 */
function resolveRange(type, params) {
  switch (type) {
    case 'custom':
      return { from: params.from, to: params.to };
    case 'daily':
      return { from: params.date, to: params.date };
    case 'weekly':
      return params.from ? { from: params.from, to: params.to } : lastSevenDaysRange(params.date);
    case 'monthly':
      return params.from ? { from: params.from, to: params.to } : previousMonthRange(params.date);
    case 'yearly':
      return params.from ? { from: params.from, to: params.to } : yearToDateRange(params.date);
    default:
      return monthToDateRange(params.date); // 'month-to-date'
  }
}

async function getReport(userId, type, params) {
  const { from, to } = resolveRange(type, params);
  const rows = await readingRepository.findInRange(userId, from, to);
  return buildReport({ type, from, to, rows });
}

/** The same report as an A4 PDF, with the patient's details from their profile. */
async function getReportPdf(userId, type, params) {
  const report = await getReport(userId, type, params);
  const user = await userRepository.findById(userId);
  if (!user) throw new HttpError(401, 'Your session has expired. Please log in again.');

  const pdf = await renderReportPdf({
    profile: toProfile(user),
    report,
    generatedOn: todayInTimezone(config.timezone),
  });
  return { pdf, filename: `sweety-${type}-${report.to}.pdf` };
}

module.exports = { getReport, getReportPdf };
