const dashboardService = require('../services/dashboard.service');
const { validateSelectedDate } = require('../validators/reports.validator');

// GET /api/dashboard?date=YYYY-MM-DD   (defaults to today)
const get = async (req, res) => {
  res.json(await dashboardService.getDashboard(req.user.id, validateSelectedDate(req.query)));
};

module.exports = { get };
