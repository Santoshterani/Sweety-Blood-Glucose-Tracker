// API tests for: profile, dashboard, weekly / yearly / custom reports, PDF export, slot filter, DB upgrade.
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
const applySchema = require('../src/db/init');
const { todayInTimezone, addDays } = require('../src/utils/dates');

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const patientDetails = {
  phone: '+91 98765 43210',
  dateOfBirth: '1972-03-14',
  sex: 'Female',
  heightCm: '162',
  weightKg: '68',
  diabetesType: 'Type 2',
  diagnosedYear: '2018',
  medication: 'Metformin 500 mg',
};

async function signup(email = 'asha@example.com', name = 'Asha') {
  const res = await request(app).post('/api/auth/signup').send({ name, email, password: 'password123' });
  return res.body.token;
}
const add = (token, body) => request(app).post('/api/readings').set(auth(token)).send(body);

beforeAll(async () => {
  await applySchema();
});
beforeEach(async () => {
  await db.query('DELETE FROM readings');
  await db.query('DELETE FROM users');
});
afterAll(async () => {
  await db.pool.end();
});

describe('database upgrade', () => {
  test('applySchema adds missing profile columns to an older users table', async () => {
    await db.query('ALTER TABLE users DROP COLUMN doctor_name');
    await db.query('ALTER TABLE users DROP COLUMN target_low');
    await applySchema();
    const { rows } = await db.query(
      `SELECT column_name AS name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'users'`
    );
    const names = rows.map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining(['doctor_name', 'target_low']));
  });
});

describe('profile', () => {
  const full = {
    name: 'Asha Rao',
    email: 'Asha.Rao@Example.com',
    ...patientDetails,
    targetLow: '80',
    targetHigh: '160',
    doctorName: 'Dr. Meera Iyer',
    doctorPhone: '+91 98450 11122',
    emergencyContact: 'Ravi Rao, +91 98765 43211',
  };

  test('a new account has an empty profile with the default target range', async () => {
    const token = await signup();
    const res = await request(app).get('/api/profile').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.profile).toMatchObject({ name: 'Asha', targetLow: 70, targetHigh: 180, phone: null, age: null, bmi: null });
  });

  test('saves every field and works out age and BMI', async () => {
    const token = await signup();
    const res = await request(app).put('/api/profile').set(auth(token)).send(full);
    expect(res.status).toBe(200);
    expect(res.body.profile).toMatchObject({
      email: 'asha.rao@example.com',
      dateOfBirth: '1972-03-14',
      heightCm: 162,
      weightKg: 68,
      bmi: 25.9,
      diabetesType: 'Type 2',
      targetLow: 80,
      targetHigh: 160,
      doctorName: 'Dr. Meera Iyer',
    });
    expect(res.body.profile.age).toBeGreaterThanOrEqual(53);

    const again = await request(app).get('/api/profile').set(auth(token));
    expect(again.body.profile.medication).toBe('Metformin 500 mg');
  });

  test('optional fields still default to null or the target-range defaults', async () => {
    const token = await signup();
    const res = await request(app).put('/api/profile').set(auth(token)).send({
      ...full,
      targetLow: '',
      targetHigh: '',
      doctorName: '',
      doctorPhone: '',
      emergencyContact: '',
    });
    expect(res.status).toBe(200);
    expect(res.body.profile).toMatchObject({
      doctorName: null,
      doctorPhone: null,
      emergencyContact: null,
      targetLow: 70,
      targetHigh: 180,
    });
  });

  test('validates fields with clear messages', async () => {
    const token = await signup();
    const res = await request(app).put('/api/profile').set(auth(token)).send({
      name: '',
      email: 'nope',
      phone: 'abc',
      dateOfBirth: '2999-01-01',
      sex: 'Robot',
      heightCm: '20',
      weightKg: '5',
      diabetesType: 'Type 9',
      diagnosedYear: '1800',
      medication: 'None',
      targetLow: '200',
      targetHigh: '100',
    });
    expect(res.status).toBe(400);
    expect(res.body.errors).toMatchObject({
      name: 'Please enter your name.',
      email: 'Please enter a valid email address.',
      phone: 'Please enter a valid phone number.',
      dateOfBirth: 'Date of birth cannot be in the future.',
      sex: 'Please choose a valid option.',
      heightCm: 'Height must be between 50 and 260 cm.',
      weightKg: 'Weight must be between 10 and 400 kg.',
      diabetesType: 'Please choose a valid diabetes type.',
      targetHigh: 'Target high must be greater than target low.',
    });
    expect(res.body.errors.diagnosedYear).toMatch(/Year must be between 1900 and/);
  });

  test("can't take another user's email", async () => {
    await signup('ravi@example.com', 'Ravi');
    const token = await signup('asha@example.com', 'Asha');
    const res = await request(app).put('/api/profile').set(auth(token)).send({ ...full, name: 'Asha', email: 'RAVI@example.com' });
    expect(res.status).toBe(409);
    expect(res.body.errors.email).toBe('An account with this email already exists.');
  });

  test('needs a login', async () => {
    expect((await request(app).get('/api/profile')).status).toBe(401);
  });
});

describe('reports: weekly, yearly, custom', () => {
  async function seed(token) {
    const rows = [
      ['2025-01-05', 'morning', 100],
      ['2025-03-10', 'morning', 120],
      ['2025-10-09', 'morning', 90], // first day of the week ending 15 Oct
      ['2025-10-12', 'after_lunch', 150],
      ['2025-10-15', 'morning', 110],
      ['2025-10-15', 'after_dinner', 190],
      ['2025-10-20', 'morning', 300], // after the selected date
    ];
    for (const [date, slot, value] of rows) expect((await add(token, { date, slot, value })).status).toBe(201);
  }

  test('weekly: the 7 days ending on the date, broken down by day', async () => {
    const token = await signup();
    await seed(token);
    const res = await request(app).get('/api/reports/weekly?date=2025-10-15').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ type: 'weekly', from: '2025-10-09', to: '2025-10-15', count: 4, highest: 190, lowest: 90, average: 135, bucketBy: 'day' });
    expect(res.body.buckets.map((b) => [b.label, b.count, b.avg])).toEqual([
      ['Thu 9', 1, 90],
      ['Sun 12', 1, 150],
      ['Wed 15', 2, 150],
    ]);
  });

  test('yearly: 1 Jan to the date, broken down by month', async () => {
    const token = await signup();
    await seed(token);
    const res = await request(app).get('/api/reports/yearly?date=2025-10-15').set(auth(token));
    expect(res.body).toMatchObject({ from: '2025-01-01', to: '2025-10-15', count: 6, bucketBy: 'month' });
    expect(res.body.buckets.map((b) => [b.label, b.count])).toEqual([['Jan', 1], ['Mar', 1], ['Oct', 4]]);
  });

  test('custom: any range, with a day-by-day breakdown for short ranges', async () => {
    const token = await signup();
    await seed(token);
    const res = await request(app).get('/api/reports/custom?from=2025-10-10&to=2025-10-20').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ type: 'custom', from: '2025-10-10', to: '2025-10-20', count: 4, highest: 300, lowest: 110, bucketBy: 'day' });
  });

  test('custom: a range with no readings is an empty report, not an error', async () => {
    const token = await signup();
    const res = await request(app).get('/api/reports/custom?from=2025-02-01&to=2025-02-28').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ count: 0, highest: null, average: null, buckets: [] });
  });

  test('custom: validates the dates', async () => {
    const token = await signup();
    const get = (q) => request(app).get(`/api/reports/custom?${q}`).set(auth(token));

    expect((await get('')).body.errors).toMatchObject({ from: 'Please select a start date.', to: 'Please select an end date.' });
    expect((await get('from=2025-10-10&to=2025-10-01')).body.errors.to).toBe('End date must be on or after the start date.');
    expect((await get('from=nope&to=2025-10-01')).body.errors.from).toMatch(/valid start date/);

    const tomorrow = addDays(todayInTimezone('Asia/Kolkata'), 1);
    expect((await get(`from=2025-10-01&to=${tomorrow}`)).body.errors.to).toBe('Date cannot be in the future.');
    expect((await get('from=2015-01-01&to=2025-10-01')).body.errors.to).toBe('Date range cannot be longer than 5 years.');
  });

  test('unknown report type is a 404', async () => {
    const token = await signup();
    expect((await request(app).get('/api/reports/hourly').set(auth(token))).status).toBe(404);
  });
});

describe('readings: slot filter', () => {
  test('filters the list by slot and rejects an unknown slot', async () => {
    const token = await signup();
    await add(token, { date: '2025-10-14', slot: 'morning', value: 90 });
    await add(token, { date: '2025-10-14', slot: 'after_lunch', value: 140 });
    await add(token, { date: '2025-10-15', slot: 'morning', value: 95 });

    const res = await request(app).get('/api/readings?slot=morning').set(auth(token));
    expect(res.body.data.map((r) => r.value)).toEqual([95, 90]);
    expect(res.body.pagination.total).toBe(2);

    expect((await request(app).get('/api/readings?slot=midnight').set(auth(token))).status).toBe(400);
  });
});

describe('dashboard', () => {
  test('today, 7-day summary, 14-day trend and recent readings', async () => {
    const token = await signup();
    const today = todayInTimezone('Asia/Kolkata');
    await add(token, { date: today, slot: 'morning', value: 104 });
    await add(token, { date: today, slot: 'after_breakfast', value: 200 });
    await add(token, { date: addDays(today, -1), slot: 'after_dinner', value: 140 });
    await add(token, { date: addDays(today, -10), slot: 'morning', value: 60 }); // outside the 7 days, inside the 14

    const res = await request(app).get('/api/dashboard').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ date: today, name: 'Asha', target: { low: 70, high: 180 } });

    expect(res.body.today.logged).toBe(2);
    expect(res.body.today.slots.map((s) => [s.slot, s.reading && s.reading.value])).toEqual([
      ['morning', 104],
      ['after_breakfast', 200],
      ['after_lunch', null],
      ['after_dinner', null],
    ]);

    expect(res.body.week).toMatchObject({ count: 3, highest: 200, lowest: 104, average: 148, inRangePercent: 67 });
    expect(res.body.week.highestReading).toMatchObject({ value: 200, slotLabel: 'After breakfast', date: today });

    expect(res.body.trend).toHaveLength(14);
    expect(res.body.trend[13]).toMatchObject({ date: today, count: 2, average: 152 });
    expect(res.body.trend[3]).toMatchObject({ date: addDays(today, -10), average: 60 });
    expect(res.body.trend[0].average).toBeNull();

    expect(res.body.recent.map((r) => r.value)).toEqual([200, 104, 140, 60]); // newest first
  });

  test("uses the user's own target range for the in-range percentage", async () => {
    const token = await signup();
    await request(app).put('/api/profile').set(auth(token)).send({
      name: 'Asha',
      email: 'asha@example.com',
      ...patientDetails,
      targetLow: '100',
      targetHigh: '120',
    });
    const today = todayInTimezone('Asia/Kolkata');
    await add(token, { date: today, slot: 'morning', value: 110 });
    await add(token, { date: today, slot: 'after_lunch', value: 150 });
    const res = await request(app).get('/api/dashboard').set(auth(token));
    expect(res.body.target).toEqual({ low: 100, high: 120 });
    expect(res.body.week.inRangePercent).toBe(50);
  });

  test('empty account: zero counts and null stats, not an error', async () => {
    const token = await signup();
    const res = await request(app).get('/api/dashboard').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.week).toMatchObject({ count: 0, average: null, inRangePercent: null, highestReading: null });
    expect(res.body.recent).toEqual([]);
  });

  test('rejects a future date', async () => {
    const token = await signup();
    expect((await request(app).get('/api/dashboard?date=2999-01-01').set(auth(token))).status).toBe(400);
  });
});

describe('PDF export', () => {
  const pdf = (token, query) =>
    request(app)
      .get(`/api/reports/pdf?${query}`)
      .set(auth(token))
      .buffer(true)
      .parse((res, cb) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });

  test('returns a real PDF download for every report type', async () => {
    const token = await signup();
    await add(token, { date: '2025-10-15', slot: 'morning', value: 110 });
    await add(token, { date: '2025-10-14', slot: 'morning', value: 190 });

    for (const query of [
      'type=daily&date=2025-10-15',
      'type=weekly&date=2025-10-15',
      'type=monthly&date=2025-11-15',
      'type=yearly&date=2025-10-15',
      'type=custom&from=2025-10-01&to=2025-10-31',
    ]) {
      const res = await pdf(token, query);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toMatch(/^attachment; filename="sweety-.+\.pdf"$/);
      expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
      expect(res.body.length).toBeGreaterThan(1500);
    }
  });

  test('an empty period still produces a PDF', async () => {
    const token = await signup();
    const res = await pdf(token, 'type=weekly&date=2025-10-15');
    expect(res.status).toBe(200);
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
  });

  test('a long table spills onto a second page without failing', async () => {
    const token = await signup();
    // 60 days of readings -> a "custom" report broken into weeks, plus a year view with many buckets
    for (let i = 0; i < 40; i++) {
      await add(token, { date: addDays('2025-01-01', i * 8), slot: 'morning', value: 100 + (i % 50) });
    }
    const res = await pdf(token, 'type=custom&from=2025-01-01&to=2025-12-31');
    expect(res.status).toBe(200);
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
  });

  test('validation errors are JSON, not a broken PDF', async () => {
    const token = await signup();
    const res = await request(app).get('/api/reports/pdf?type=custom&from=2025-10-10&to=2025-10-01').set(auth(token));
    expect(res.status).toBe(400);
    expect(res.body.errors.to).toBe('End date must be on or after the start date.');
    expect((await request(app).get('/api/reports/pdf?type=bogus').set(auth(token))).status).toBe(404);
  });

  test('needs a login', async () => {
    expect((await request(app).get('/api/reports/pdf?type=daily')).status).toBe(401);
  });
});
