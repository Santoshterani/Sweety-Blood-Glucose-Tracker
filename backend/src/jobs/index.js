const config = require('../config');
const { scheduleDailyReminder, closeQueue } = require('./dailyReminder.queue');
const { startDailyReminderWorker } = require('./dailyReminder.worker');

let worker = null;

/** Registers the daily schedule and starts the worker that runs it. */
async function startJobs() {
  await scheduleDailyReminder();
  worker = startDailyReminderWorker();
  console.log(`Daily reminder job scheduled: "${config.reminders.cron}" (${config.timezone})`);
  return worker;
}

async function stopJobs() {
  if (worker) await worker.close();
  worker = null;
  await closeQueue();
}

module.exports = { startJobs, stopJobs };
