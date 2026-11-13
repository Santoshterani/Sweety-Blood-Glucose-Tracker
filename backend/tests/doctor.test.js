// Doctor role: accounts, choosing a doctor, and what a doctor may (and may not) see.
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
const applySchema = require('../src/db/init');
const { todayInTimezone, addDays } = require('../src/utils/dates');

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const today = todayInTimezone('Asia/Kolkata');

async function signup(email, name, role) {
  const res = await request(app).post('/api/auth/signup').send({ name, email, password: 'password123', role });
  return { token: res.body.token, user: res.body.user, status: res.status };
}
const add = (token, body) => request(app).post('/api/readings').set(auth(token)).send(body);
const choose = (token, doctorId) =>
  request(app).put('/api/profile').set(auth(token)).send({
    name: 'Asha',
    email: 'asha@example.com',
    phone: '123456',
    dateOfBirth: '1990-01-01',
    sex: 'Female',
    heightCm: 165,
    weightKg: 60,
    diabetesType: 'Type 2',
    diagnosedYear: 2010,
    medication: 'None',
    doctorId,
  });

let doctor;
let otherDoctor;
let asha;
let ben;

beforeAll(async () => {
  await applySchema();
});
beforeEach(async () => {
  await db.query('DELETE FROM reminder_logs');
  await db.query('DELETE FROM readings');
  await db.query('DELETE FROM users');
  doctor = await signup('dr.iyer@example.com', 'Dr. Meera Iyer', 'doctor');
  otherDoctor = await signup('dr.rao@example.com', 'Dr. Rao', 'doctor');
  asha = await signup('asha@example.com', 'Asha', 'patient');
  ben = await signup('ben@example.com', 'Ben', 'patient');
});
afterAll(async () => {
  await db.pool.end();
});

describe('accounts and roles', () => {
  test('signup creates a patient by default and a doctor when asked', async () => {
    const noRole = await request(app).post('/api/auth/signup').send({ name: 'X', email: 'x@example.com', password: 'password123' });
    expect(noRole.body.user.role).toBe('patient');
    expect(doctor.user.role).toBe('doctor');
    expect(doctor.status).toBe(201);
  });

  test('unknown roles are rejected, so nobody can sign up as an admin', async () => {
    const res = await signup('evil@example.com', 'Evil', 'admin');
    expect(res.status).toBe(400);
  });

  test('login and /me return the role', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'dr.iyer@example.com', password: 'password123' });
    expect(login.body.user.role).toBe('doctor');
    const me = await request(app).get('/api/auth/me').set(auth(login.body.token));
    expect(me.body.user.role).toBe('doctor');
  });

  test('doctors cannot use the patient screens', async () => {
    for (const path of ['/api/readings', '/api/dashboard', '/api/reports/weekly', '/api/reminders', '/api/doctors']) {
      const res = await request(app).get(path).set(auth(doctor.token));
      expect(res.status).toBe(403);
    }
    expect((await add(doctor.token, { value: 100, date: today, slot: 'morning' })).status).toBe(403);
  });

  test('patients cannot use the doctor screens', async () => {
    for (const path of ['/api/doctor/patients', '/api/doctor/patients/1', '/api/doctor/patients/1/reports/weekly']) {
      expect((await request(app).get(path).set(auth(asha.token))).status).toBe(403);
    }
  });

  test('doctor routes need a login', async () => {
    expect((await request(app).get('/api/doctor/patients')).status).toBe(401);
  });

  test('old tokens without a role count as patient tokens', async () => {
    const jwt = require('jsonwebtoken');
    const old = jwt.sign({ sub: String(asha.user.id) }, process.env.JWT_SECRET);
    expect((await request(app).get('/api/readings').set(auth(old))).status).toBe(200);
    expect((await request(app).get('/api/doctor/patients').set(auth(old))).status).toBe(403);
  });
});

describe('choosing a doctor', () => {
  test('patients can list doctors: ids and names only', async () => {
    const res = await request(app).get('/api/doctors').set(auth(asha.token));
    expect(res.status).toBe(200);
    expect(res.body.doctors.map((d) => d.name)).toEqual(['Dr. Meera Iyer', 'Dr. Rao']);
    expect(Object.keys(res.body.doctors[0]).sort()).toEqual(['id', 'name']);
  });

  test('a patient picks a doctor, changes it, and clears it', async () => {
    let res = await choose(asha.token, doctor.user.id);
    expect(res.status).toBe(200);
    expect(res.body.profile.doctorId).toBe(doctor.user.id);

    res = await choose(asha.token, otherDoctor.user.id);
    expect(res.body.profile.doctorId).toBe(otherDoctor.user.id);

    res = await choose(asha.token, '');
    expect(res.body.profile.doctorId).toBeNull();
  });

  test('only real doctor accounts can be chosen', async () => {
    for (const id of [ben.user.id, 999999]) {
      const res = await choose(asha.token, id);
      expect(res.status).toBe(400);
      expect(res.body.errors.doctorId).toBe('Please choose a valid doctor.');
    }
  });

  test('a doctor profile never gets a doctor of their own', async () => {
    const res = await request(app)
      .put('/api/profile')
      .set(auth(doctor.token))
      .send({
        name: 'Dr. Meera Iyer',
        email: 'dr.iyer@example.com',
        phone: '123456',
        dateOfBirth: '1980-01-01',
        sex: 'Other',
        doctorId: otherDoctor.user.id,
      });
    expect(res.status).toBe(200);
    expect(res.body.profile.doctorId).toBeNull();
  });
});

describe('what a doctor sees', () => {
  beforeEach(async () => {
    await choose(asha.token, doctor.user.id);
    // Asha: 2 readings today (one in range, one high), 1 yesterday (low)
    await add(asha.token, { value: 100, date: today, slot: 'morning' });
    await add(asha.token, { value: 200, date: today, slot: 'after_lunch' });
    await add(asha.token, { value: 60, date: addDays(today, -1), slot: 'morning' });
    // Ben has readings but chose nobody
    await add(ben.token, { value: 111, date: today, slot: 'morning' });
  });

  test('lists only their own patients, with a 7-day summary', async () => {
    const res = await request(app).get('/api/doctor/patients').set(auth(doctor.token));
    expect(res.status).toBe(200);
    expect(res.body.patients).toHaveLength(1);
    const p = res.body.patients[0];
    expect(p).toMatchObject({ id: asha.user.id, name: 'Asha', targetLow: 70, targetHigh: 180 });
    expect(p.week).toEqual({ count: 3, average: 120, highest: 200, lowest: 60, inRangePercent: 33 });
    expect(p.lastReading).toMatchObject({ date: today, value: 200, slotLabel: 'After lunch' });
    expect(p).not.toHaveProperty('password_hash');
    expect(p).not.toHaveProperty('emergencyContact');
  });

  test('another doctor sees nobody', async () => {
    const res = await request(app).get('/api/doctor/patients').set(auth(otherDoctor.token));
    expect(res.body.patients).toEqual([]);
  });

  test('a patient with no readings still appears, with an empty summary', async () => {
    await db.query('UPDATE users SET doctor_id = $1 WHERE id = $2', [doctor.user.id, ben.user.id]);
    await db.query('DELETE FROM readings WHERE user_id = $1', [ben.user.id]);
    const res = await request(app).get('/api/doctor/patients').set(auth(doctor.token));
    const b = res.body.patients.find((x) => x.id === ben.user.id);
    expect(b.week).toEqual({ count: 0, average: null, highest: null, lowest: null, inRangePercent: null });
    expect(b.lastReading).toBeNull();
  });

  test('patient details', async () => {
    const res = await request(app).get(`/api/doctor/patients/${asha.user.id}`).set(auth(doctor.token));
    expect(res.status).toBe(200);
    expect(res.body.patient.name).toBe('Asha');
  });

  test('reports: the same numbers the patient sees', async () => {
    const mine = await request(app).get('/api/reports/weekly').set(auth(asha.token));
    const theirs = await request(app).get(`/api/doctor/patients/${asha.user.id}/reports/weekly`).set(auth(doctor.token));
    expect(theirs.status).toBe(200);
    expect(theirs.body).toEqual(mine.body);
    expect(theirs.body).toMatchObject({ count: 3, highest: 200, lowest: 60, average: 120 });
  });

  test('daily, custom and bad report requests', async () => {
    const base = `/api/doctor/patients/${asha.user.id}/reports`;
    const daily = await request(app).get(`${base}/daily?date=${today}`).set(auth(doctor.token));
    expect(daily.body.count).toBe(2);

    const custom = await request(app).get(`${base}/custom?from=${addDays(today, -3)}&to=${today}`).set(auth(doctor.token));
    expect(custom.body.count).toBe(3);

    const bad = await request(app).get(`${base}/custom?from=${today}&to=${addDays(today, -3)}`).set(auth(doctor.token));
    expect(bad.status).toBe(400);
    expect(bad.body.errors.to).toBe('End date must be on or after the start date.');

    expect((await request(app).get(`${base}/hourly`).set(auth(doctor.token))).status).toBe(404);
  });

  test('PDF export of a patient report', async () => {
    const res = await request(app)
      .get(`/api/doctor/patients/${asha.user.id}/reports/pdf?type=weekly`)
      .set(auth(doctor.token))
      .buffer(true)
      .parse((r, cb) => {
        const chunks = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
  });

  test('patients who are not yours look like they do not exist', async () => {
    const paths = [
      `/api/doctor/patients/${ben.user.id}`, // a real patient, but not assigned
      `/api/doctor/patients/${ben.user.id}/reports/weekly`,
      `/api/doctor/patients/${ben.user.id}/reports/pdf?type=weekly`,
      `/api/doctor/patients/${otherDoctor.user.id}`, // a doctor, not a patient
      '/api/doctor/patients/999999',
      '/api/doctor/patients/abc',
    ];
    for (const path of paths) {
      const res = await request(app).get(path).set(auth(doctor.token));
      expect([path, res.status, res.body.error]).toEqual([path, 404, 'Patient not found.']);
    }
    // ...and another doctor cannot read Asha either
    const res = await request(app).get(`/api/doctor/patients/${asha.user.id}/reports/weekly`).set(auth(otherDoctor.token));
    expect(res.status).toBe(404);
  });

  test('once the patient clears their doctor, access stops', async () => {
    await choose(asha.token, '');
    const res = await request(app).get(`/api/doctor/patients/${asha.user.id}`).set(auth(doctor.token));
    expect(res.status).toBe(404);
  });

  test('deleting a doctor account unassigns their patients instead of deleting them', async () => {
    await db.query('DELETE FROM users WHERE id = $1', [doctor.user.id]);
    const me = await request(app).get('/api/profile').set(auth(asha.token));
    expect(me.body.profile.doctorId).toBeNull();
  });
});
