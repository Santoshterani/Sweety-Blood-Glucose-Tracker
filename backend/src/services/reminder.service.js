const config = require('../config');
const reminderRepository = require('../repositories/reminder.repository');
const { todayInTimezone } = require('../utils/dates');
const { MAX_READINGS_PER_DAY } = require('../utils/slots');

/**
 * The daily reminder: every patient with fewer than 4 readings on `date` (default: today in the
 * app's timezone) gets a row in reminder_logs and a line in the console.
 * Returns what was logged, e.g. [{ userId, name, readingsCount }].
 */
async function logDailyReminders({ date = todayInTimezone(config.timezone), log = console.log } = {}) {
  const rows = await reminderRepository.logPatientsBelow(date, MAX_READINGS_PER_DAY);
  const reminded = rows.map((r) => ({ userId: r.user_id, name: r.name, readingsCount: r.readings_count }));

  for (const r of reminded) {
    log(`[reminder] ${date}: ${r.name} (user ${r.userId}) has ${r.readingsCount} of ${MAX_READINGS_PER_DAY} readings`);
  }
  log(`[reminder] ${date}: ${reminded.length} patient(s) reminded`);
  return { date, reminded };
}

/** The patient's own latest reminders, newest first. */
async function listForUser(userId, limit = 10) {
  const rows = await reminderRepository.findRecentForUser(userId, limit);
  return rows.map((r) => ({
    id: r.id,
    date: r.reminder_date,
    readingsCount: r.readings_count,
    message: `You had ${r.readings_count} of ${MAX_READINGS_PER_DAY} readings logged.`,
    createdAt: r.created_at,
  }));
}

module.exports = { logDailyReminders, listForUser };
