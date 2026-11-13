const reminderService = require('../services/reminder.service');

// GET /api/reminders  - the patient's own latest daily reminders
const list = async (req, res) => {
  res.json({ reminders: await reminderService.listForUser(req.user.id) });
};

module.exports = { list };
