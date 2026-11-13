const { Worker } = require('bullmq');
const config = require('../config');
const { redisConnection } = require('./connection');
const { QUEUE_NAME } = require('./dailyReminder.queue');
const { dailyReminderProcessor } = require('./processors/dailyReminder.processor');

function startDailyReminderWorker() {
  const worker = new Worker(QUEUE_NAME, dailyReminderProcessor, {
    connection: redisConnection(),
    prefix: config.queuePrefix,
    concurrency: 1,
  });
  worker.on('completed', (job, result) => console.log(`[reminder worker] job ${job.id} done:`, JSON.stringify(result)));
  worker.on('failed', (job, err) => console.error(`[reminder worker] job ${job && job.id} failed:`, err.message));
  worker.on('error', (err) => console.error('[reminder worker]', err.message));
  return worker;
}

module.exports = { startDailyReminderWorker };
