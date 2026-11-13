// Runs the daily reminder right now, without Redis:  npm run reminders:run [-- YYYY-MM-DD]
const applySchema = require('../db/init');
const { pool } = require('../db/pool');
const reminderService = require('../services/reminder.service');
const { isValidDateString } = require('../utils/dates');

async function main() {
  const date = process.argv[2];
  if (date && !isValidDateString(date)) throw new Error('Date must look like 2026-11-13.');
  await applySchema();
  await reminderService.logDailyReminders({ date });
  await pool.end();
}

main().catch((err) => {
  console.error('Could not run the reminders:', err.message);
  process.exit(1);
});
