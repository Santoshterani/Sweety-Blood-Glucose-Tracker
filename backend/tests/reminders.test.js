// Daily reminder: the service (no Redis needed) and the real BullMQ queue + worker (needs Redis).
const net = require('net');
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
const applySchema = require('../src/db/init');
const reminderService = require('../src/services/reminder.service');
const { todayInTimezone, addDays } = require('../src/utils/dates');

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const today = todayInTimezone('Asia/Kolkata');
const SLOTS = ['morning', 'after_breakfast', 'after_lunch', 'after_dinner'];

async function signup(email, name, role = 'patient') {
  const res = await request(app).post('/api/auth/signup').send({ name, email, password: 'password123', role });
  return res.body;
}
async function addReadings(token, n, date = today) {
  for (let i = 0; i < n; i++) {
    await request(app).post('/api/readings').set(auth(token)).send({ date, slot: SLOTS[i], value: 100 + i });
  }
}
const logs = async () => (await db.query('SELECT u.name, l.reminder_date AS reading_date, l.readings_count FROM reminder_logs l JOIN users u ON u.id = l.user_id ORDER BY u.name')).rows;
const quiet = () => {};

beforeAll(async () => {
  await applySchema();
});
beforeEach(async () => {
  await db.query('DELETE FROM reminder_logs');
  await db.query('DELETE FROM readings');
  await db.query('DELETE FROM users');
});
afterAll(async () => {
  await db.pool.end();
});

describe('daily reminder service', () => {
  test('logs exactly the patients with fewer than 4 readings today', async () => {
    const none = await signup('none@example.com', 'None');
    const two = await signup('two@example.com', 'Two');
    const three = await signup('three@example.com', 'Three');
    const four = await signup('four@example.com', 'Four');
    await addReadings(two.token, 2);
    await addReadings(three.token, 3);
    await addReadings(four.token, 4);

    const result = await reminderService.logDailyReminders({ log: quiet });

    expect(result.date).toBe(today);
    expect(result.reminded.map((r) => [r.name, r.readingsCount])).toEqual([
      ['None', 0],
      ['Two', 2],
      ['Three', 3],
    ]);
    expect((await logs()).map((l) => [l.name, l.readings_count])).toEqual([
      ['None', 0],
      ['Three', 3],
      ['Two', 2],
    ]);
    expect(none.user.role).toBe('patient');
  });

  test("only today's readings count, not other days", async () => {
    const asha = await signup('asha@example.com', 'Asha');
    await addReadings(asha.token, 4, addDays(today, -1)); // a full day yesterday
    await addReadings(asha.token, 1); // one today
    const result = await reminderService.logDailyReminders({ log: quiet });
    expect(result.reminded).toEqual([expect.objectContaining({ name: 'Asha', readingsCount: 1 })]);
  });

  test('doctors are never reminded', async () => {
    await signup('dr@example.com', 'Dr. Who', 'doctor');
    const result = await reminderService.logDailyReminders({ log: quiet });
    expect(result.reminded).toEqual([]);
    expect(await logs()).toEqual([]);
  });

  test('running it twice for the same day does not log anyone twice', async () => {
    await signup('asha@example.com', 'Asha');
    const first = await reminderService.logDailyReminders({ log: quiet });
    const second = await reminderService.logDailyReminders({ log: quiet });
    expect(first.reminded).toHaveLength(1);
    expect(second.reminded).toHaveLength(0);
    expect(await logs()).toHaveLength(1);
  });

  test('a past date can be run for, and prints one line per patient plus a total', async () => {
    await signup('asha@example.com', 'Asha');
    const lines = [];
    await reminderService.logDailyReminders({ date: '2026-01-05', log: (l) => lines.push(l) });
    expect(lines).toEqual([
      expect.stringMatching(/^\[reminder\] 2026-01-05: Asha \(user \d+\) has 0 of 4 readings$/),
      '[reminder] 2026-01-05: 1 patient(s) reminded',
    ]);
    expect((await logs())[0].reading_date).toBe('2026-01-05');
  });

  test('patients see their own reminders through the API', async () => {
    const asha = await signup('asha@example.com', 'Asha');
    const ben = await signup('ben@example.com', 'Ben');
    await reminderService.logDailyReminders({ date: '2026-01-05', log: quiet });
    await reminderService.logDailyReminders({ date: '2026-01-06', log: quiet });

    const res = await request(app).get('/api/reminders').set(auth(asha.token));
    expect(res.status).toBe(200);
    expect(res.body.reminders.map((r) => r.date)).toEqual(['2026-01-06', '2026-01-05']); // newest first
    expect(res.body.reminders[0]).toMatchObject({ readingsCount: 0, message: 'You had 0 of 4 readings logged.' });
    expect((await request(app).get('/api/reminders').set(auth(ben.token))).body.reminders).toHaveLength(2);
    expect((await request(app).get('/api/reminders')).status).toBe(401);
  });
});

// ---- the real queue and worker ----------------------------------------------------------------
const { redisConnection } = require('../src/jobs/connection');

function redisIsUp() {
  const { host, port } = redisConnection();
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, timeout: 800 });
    socket.on('connect', () => socket.destroy(resolve(true)));
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => socket.destroy(resolve(false)));
  });
}

describe('BullMQ queue and worker', () => {
  let up = false;
  let jobs;
  let queueModule;

  beforeAll(async () => {
    up = await redisIsUp();
    if (!up) {
      console.warn('Redis is not running: skipping the BullMQ integration tests.');
      return;
    }
    jobs = require('../src/jobs');
    queueModule = require('../src/jobs/dailyReminder.queue');
    await queueModule.getQueue().obliterate({ force: true });
  });
  afterAll(async () => {
    if (up) {
      await queueModule.getQueue().obliterate({ force: true });
      await jobs.stopJobs();
    }
  });

  const waitFor = async (check, ms = 8000) => {
    const start = Date.now();
    while (Date.now() - start < ms) {
      const value = await check();
      if (value) return value;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('Timed out waiting for the job');
  };

  test('the worker picks up a queued job and writes the reminder log', async () => {
    if (!up) return;
    await signup('asha@example.com', 'Asha');
    await jobs.startJobs();

    await queueModule.enqueueNow({ date: '2026-02-03' });
    const rows = await waitFor(async () => {
      const r = await logs();
      return r.length ? r : null;
    });
    expect(rows).toEqual([expect.objectContaining({ name: 'Asha', reading_date: '2026-02-03', readings_count: 0 })]);
  });

  test('the daily schedule is registered once, even if start-up runs twice', async () => {
    if (!up) return;
    await queueModule.scheduleDailyReminder();
    await queueModule.scheduleDailyReminder();
    const schedulers = await queueModule.getQueue().getJobSchedulers();
    expect(schedulers).toHaveLength(1);
    expect(schedulers[0]).toMatchObject({ key: 'daily-reminder-schedule', pattern: '0 20 * * *', tz: 'Asia/Kolkata' });
  });
});
