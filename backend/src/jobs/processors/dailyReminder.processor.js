const reminderService = require('../../services/reminder.service');

/**
 * The BullMQ processor: it only unpacks the job and calls the service, where the real work lives.
 * `job.data.date` is optional ('YYYY-MM-DD'); without it the service uses today in the app's timezone.
 */
async function dailyReminderProcessor(job) {
  const result = await reminderService.logDailyReminders({ date: job.data && job.data.date });
  return { date: result.date, reminded: result.reminded.length };
}

module.exports = { dailyReminderProcessor };
