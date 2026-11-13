const { Queue } = require('bullmq');
const config = require('../config');
const { redisConnection } = require('./connection');

const QUEUE_NAME = 'daily-reminders';
const JOB_NAME = 'log-daily-reminders';
const SCHEDULER_ID = 'daily-reminder-schedule';

let queue = null;

function getQueue() {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, { connection: redisConnection(), prefix: config.queuePrefix });
    // Without a listener a Redis outage would crash the process with an unhandled 'error' event.
    queue.on('error', (err) => console.error('[reminder queue]', err.message));
  }
  return queue;
}

/**
 * Registers the repeating job: every day at `config.reminders.cron`, in the app's timezone.
 * Safe to call on every start-up: BullMQ updates the one schedule with this id instead of adding another.
 */
async function scheduleDailyReminder() {
  await getQueue().upsertJobScheduler(
    SCHEDULER_ID,
    { pattern: config.reminders.cron, tz: config.timezone },
    {
      name: JOB_NAME,
      data: {}, // no date: the worker uses "today" at the moment it runs
      opts: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 30 },
        removeOnFail: { count: 100 },
      },
    }
  );
}

/** Adds a one-off job (used by `npm run reminders:enqueue` and the tests). */
const enqueueNow = (data = {}) =>
  getQueue().add(JOB_NAME, data, { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true });

async function closeQueue() {
  if (queue) {
    await queue.close();
    queue = null;
  }
}

module.exports = { QUEUE_NAME, JOB_NAME, getQueue, scheduleDailyReminder, enqueueNow, closeQueue };
