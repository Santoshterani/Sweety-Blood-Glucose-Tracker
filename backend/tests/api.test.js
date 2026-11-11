// API tests against a real PostgreSQL test database (see tests/setupEnv.js).
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
const { todayInTimezone } = require('../src/utils/dates');

const PAST = '2025-10-15'; // always in the past, so these tests never depend on today's date

async function signup(email = 'asha@example.com', name = 'Asha') {
  const res = await request(app).post('/api/auth/signup').send({ name, email, password: 'password123' });
  return { token: res.body.token, user: res.body.user, res };
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

async function addReading(token, body) {
  return request(app).post('/api/readings').set(auth(token)).send(body);
}

beforeAll(async () => {
  await db.query(fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8'));
});

beforeEach(async () => {
  await db.query('TRUNCATE readings, users RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await db.pool.end();
});

describe('auth', () => {
  test('signup stores a bcrypt hash, never the plain password', async () => {
    const { res } = await signup();
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user).toEqual({ id: expect.any(Number), name: 'Asha', email: 'asha@example.com' });
    expect(res.body.user.password_hash).toBeUndefined();

    const { rows } = await db.query('SELECT password_hash FROM users');
    expect(rows[0].password_hash).not.toBe('password123');
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$/);
  });

  test('duplicate email (any letter case) is rejected', async () => {
    await signup('asha@example.com');
    const { res } = await signup('ASHA@example.com');
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('An account with this email already exists.');
  });

  test('login works with the right password and fails with a wrong one', async () => {
    await signup();
    const ok = await request(app).post('/api/auth/login').send({ email: 'asha@example.com', password: 'password123' });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTruthy();

    const bad = await request(app).post('/api/auth/login').send({ email: 'asha@example.com', password: 'wrongpass1' });
    expect(bad.status).toBe(401);
    expect(bad.body.error).toBe('Invalid email or password.');
  });

  test('readings need a login', async () => {
    const res = await request(app).get('/api/readings');
    expect(res.status).toBe(401);
  });
});

describe('readings: validation rules', () => {
  let token;
  beforeEach(async () => {
    ({ token } = await signup());
  });

  test('creates a reading', async () => {
    const res = await addReading(token, { date: PAST, slot: 'morning', value: 110 });
    expect(res.status).toBe(201);
    expect(res.body.reading).toMatchObject({ date: PAST, slot: 'morning', slotLabel: 'Morning (fasting)', value: 110 });
  });

  test('missing value -> clear message', async () => {
    const res = await addReading(token, { date: PAST, slot: 'morning' });
    expect(res.status).toBe(400);
    expect(res.body.errors.value).toBe('Please enter a glucose value.');
  });

  test('value out of range -> clear message', async () => {
    const res = await addReading(token, { date: PAST, slot: 'morning', value: 700 });
    expect(res.status).toBe(400);
    expect(res.body.errors.value).toBe('Value must be between 40 and 600 mg/dl.');
  });

  test('future date -> clear message', async () => {
    const tomorrow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const res = await addReading(token, { date: tomorrow, slot: 'morning', value: 100 });
    expect(res.status).toBe(400);
    expect(res.body.errors.date).toBe('Date cannot be in the future.');
  });

  test("today's date is allowed", async () => {
    const today = todayInTimezone('Asia/Kolkata');
    const res = await addReading(token, { date: today, slot: 'morning', value: 100 });
    expect(res.status).toBe(201);
  });

  test('only one reading per slot per day', async () => {
    await addReading(token, { date: PAST, slot: 'after_lunch', value: 140 });
    const res = await addReading(token, { date: PAST, slot: 'after_lunch', value: 150 });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('You already have an After lunch reading for this date.');
  });

  test('uses "a" before slot names that start with a consonant', async () => {
    await addReading(token, { date: PAST, slot: 'morning', value: 90 });
    const res = await addReading(token, { date: PAST, slot: 'morning', value: 95 });
    expect(res.body.error).toBe('You already have a Morning (fasting) reading for this date.');
  });

  test('same slot on a different day is fine', async () => {
    await addReading(token, { date: PAST, slot: 'morning', value: 90 });
    const res = await addReading(token, { date: '2025-10-16', slot: 'morning', value: 95 });
    expect(res.status).toBe(201);
  });

  test('maximum 4 readings per day', async () => {
    for (const slot of ['morning', 'after_breakfast', 'after_lunch', 'after_dinner']) {
      const ok = await addReading(token, { date: PAST, slot, value: 120 });
      expect(ok.status).toBe(201);
    }
    const res = await addReading(token, { date: PAST, slot: 'morning', value: 120 });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('You can add only 4 readings per day.');
  });

  test('two simultaneous requests for the same slot cannot both succeed', async () => {
    const results = await Promise.all([
      addReading(token, { date: PAST, slot: 'morning', value: 100 }),
      addReading(token, { date: PAST, slot: 'morning', value: 101 }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const { rows } = await db.query('SELECT COUNT(*)::int AS n FROM readings');
    expect(rows[0].n).toBe(1);
  });
});

describe('readings: edit, delete and privacy', () => {
  test('edit a reading, and editing without changing the slot is not a "duplicate"', async () => {
    const { token } = await signup();
    const created = await addReading(token, { date: PAST, slot: 'morning', value: 100 });
    const id = created.body.reading.id;

    const res = await request(app).put(`/api/readings/${id}`).set(auth(token)).send({ date: PAST, slot: 'morning', value: 130 });
    expect(res.status).toBe(200);
    expect(res.body.reading.value).toBe(130);
  });

  test('editing into a slot that is already taken is rejected', async () => {
    const { token } = await signup();
    await addReading(token, { date: PAST, slot: 'morning', value: 100 });
    const second = await addReading(token, { date: PAST, slot: 'after_lunch', value: 150 });

    const res = await request(app)
      .put(`/api/readings/${second.body.reading.id}`)
      .set(auth(token))
      .send({ date: PAST, slot: 'morning', value: 150 });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('You already have a Morning (fasting) reading for this date.');
  });

  test('edits are validated like new readings', async () => {
    const { token } = await signup();
    const created = await addReading(token, { date: PAST, slot: 'morning', value: 100 });
    const res = await request(app)
      .put(`/api/readings/${created.body.reading.id}`)
      .set(auth(token))
      .send({ date: PAST, slot: 'morning', value: 5 });
    expect(res.status).toBe(400);
  });

  test('delete removes the reading', async () => {
    const { token } = await signup();
    const created = await addReading(token, { date: PAST, slot: 'morning', value: 100 });
    const del = await request(app).delete(`/api/readings/${created.body.reading.id}`).set(auth(token));
    expect(del.status).toBe(204);
    const list = await request(app).get('/api/readings').set(auth(token));
    expect(list.body.data).toHaveLength(0);
  });

  test("users only see - and can only change - their own readings", async () => {
    const asha = await signup('asha@example.com', 'Asha');
    const ravi = await signup('ravi@example.com', 'Ravi');
    const created = await addReading(asha.token, { date: PAST, slot: 'morning', value: 100 });
    const id = created.body.reading.id;

    const list = await request(app).get('/api/readings').set(auth(ravi.token));
    expect(list.body.data).toEqual([]);

    const edit = await request(app).put(`/api/readings/${id}`).set(auth(ravi.token)).send({ date: PAST, slot: 'morning', value: 200 });
    expect(edit.status).toBe(404);

    const del = await request(app).delete(`/api/readings/${id}`).set(auth(ravi.token));
    expect(del.status).toBe(404);

    // Ravi can use the same slot/day for himself: the rules are per user.
    const own = await addReading(ravi.token, { date: PAST, slot: 'morning', value: 90 });
    expect(own.status).toBe(201);

    const stillThere = await request(app).get('/api/readings').set(auth(asha.token));
    expect(stillThere.body.data[0].value).toBe(100);
  });

  test('list is paginated and ordered newest day first, morning -> dinner', async () => {
    const { token } = await signup();
    await addReading(token, { date: '2025-10-14', slot: 'morning', value: 90 });
    await addReading(token, { date: PAST, slot: 'after_dinner', value: 150 });
    await addReading(token, { date: PAST, slot: 'morning', value: 100 });

    const all = await request(app).get('/api/readings').set(auth(token));
    expect(all.body.data.map((r) => `${r.date}/${r.slot}`)).toEqual([
      `${PAST}/morning`,
      `${PAST}/after_dinner`,
      '2025-10-14/morning',
    ]);

    const page2 = await request(app).get('/api/readings?page=2&limit=2').set(auth(token));
    expect(page2.body.data).toHaveLength(1);
    expect(page2.body.pagination).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
  });
});

describe('reports', () => {
  // Selected date 15 Oct 2025 (the assignment's example, shifted to a past year)
  async function seed(token) {
    const rows = [
      // September (previous month)
      ['2025-09-01', 'morning', 100],
      ['2025-09-30', 'after_dinner', 200],
      // October, up to the 15th
      ['2025-10-01', 'morning', 90],
      ['2025-10-14', 'after_lunch', 150],
      ['2025-10-15', 'after_dinner', 180],
      ['2025-10-15', 'morning', 110],
      // After the selected date: must be left out of month-to-date
      ['2025-10-20', 'morning', 300],
    ];
    for (const [date, slot, value] of rows) {
      const res = await addReading(token, { date, slot, value });
      expect(res.status).toBe(201);
    }
  }

  test('daily: summary plus each reading with its slot, in day order', async () => {
    const { token } = await signup();
    await seed(token);
    const res = await request(app).get('/api/reports/daily?date=2025-10-15').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ type: 'daily', from: '2025-10-15', to: '2025-10-15', count: 2, highest: 180, lowest: 110, average: 145 });
    expect(res.body.readings.map((r) => [r.slotLabel, r.value])).toEqual([
      ['Morning (fasting)', 110],
      ['After dinner', 180],
    ]);
  });

  test('month-to-date: 1st of the month up to the selected date', async () => {
    const { token } = await signup();
    await seed(token);
    const res = await request(app).get('/api/reports/month-to-date?date=2025-10-15').set(auth(token));
    expect(res.body).toMatchObject({ from: '2025-10-01', to: '2025-10-15', count: 4, highest: 180, lowest: 90, average: 132.5 });
  });

  test('monthly: the whole previous month', async () => {
    const { token } = await signup();
    await seed(token);
    const res = await request(app).get('/api/reports/monthly?date=2025-10-15').set(auth(token));
    expect(res.body).toMatchObject({ from: '2025-09-01', to: '2025-09-30', count: 2, highest: 200, lowest: 100, average: 150 });
  });

  test('no readings -> zero count and null stats (empty state)', async () => {
    const { token } = await signup();
    for (const type of ['daily', 'month-to-date', 'monthly']) {
      const res = await request(app).get(`/api/reports/${type}?date=2025-10-15`).set(auth(token));
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ count: 0, highest: null, lowest: null, average: null });
    }
  });

  test("reports never include another user's readings", async () => {
    const asha = await signup('asha@example.com');
    const ravi = await signup('ravi@example.com');
    await addReading(asha.token, { date: '2025-10-15', slot: 'morning', value: 500 });
    const res = await request(app).get('/api/reports/daily?date=2025-10-15').set(auth(ravi.token));
    expect(res.body.count).toBe(0);
  });

  test('rejects bad or future dates', async () => {
    const { token } = await signup();
    const bad = await request(app).get('/api/reports/daily?date=nope').set(auth(token));
    expect(bad.status).toBe(400);
    const future = await request(app).get('/api/reports/daily?date=2999-01-01').set(auth(token));
    expect(future.status).toBe(400);
    expect(future.body.error).toBe('Date cannot be in the future.');
  });
});
