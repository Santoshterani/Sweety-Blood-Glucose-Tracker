// All SQL for the `users` table. No business rules here, just queries.
// Every function takes an optional `executor` (the pool by default, or a transaction client).
const db = require('../db');

const findById = async (id, executor = db) => {
  const { rows } = await executor.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
};

const findByEmail = async (email, executor = db) => {
  const { rows } = await executor.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0] || null;
};

const create = async ({ name, email, passwordHash, role = 'patient' }, executor = db) => {
  const { rows } = await executor.query(
    'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *',
    [name, email, passwordHash, role]
  );
  return rows[0];
};

const updateProfile = async (id, data, executor = db) => {
  const { rows } = await executor.query(
    `UPDATE users SET
       name = $1, email = $2, phone = $3, date_of_birth = $4, sex = $5, height_cm = $6, weight_kg = $7,
       diabetes_type = $8, diagnosed_year = $9, medication = $10, target_low = $11, target_high = $12,
       doctor_name = $13, doctor_phone = $14, emergency_contact = $15, doctor_id = $16
     WHERE id = $17
     RETURNING *`,
    [
      data.name, data.email, data.phone, data.dateOfBirth, data.sex, data.heightCm, data.weightKg,
      data.diabetesType, data.diagnosedYear, data.medication, data.targetLow, data.targetHigh,
      data.doctorName, data.doctorPhone, data.emergencyContact, data.doctorId,
      id,
    ]
  );
  return rows[0] || null;
};

/** Every doctor account, for the "My doctor" drop-down. Only the id and name are exposed by the API. */
const findDoctors = async (executor = db) => {
  const { rows } = await executor.query("SELECT id, name FROM users WHERE role = 'doctor' ORDER BY name, id");
  return rows;
};

const findDoctorById = async (id, executor = db) => {
  const { rows } = await executor.query("SELECT id, name FROM users WHERE id = $1 AND role = 'doctor'", [id]);
  return rows[0] || null;
};

/** The patients who have chosen this doctor. */
const findPatientsOfDoctor = async (doctorId, executor = db) => {
  const { rows } = await executor.query(
    "SELECT * FROM users WHERE doctor_id = $1 AND role = 'patient' ORDER BY name, id",
    [doctorId]
  );
  return rows;
};

/** One patient, but only if they have chosen this doctor. */
const findPatientOfDoctor = async (doctorId, patientId, executor = db) => {
  const { rows } = await executor.query(
    "SELECT * FROM users WHERE id = $1 AND doctor_id = $2 AND role = 'patient'",
    [patientId, doctorId]
  );
  return rows[0] || null;
};

/** Takes a row lock on the user until the transaction ends, so one user's writes happen one at a time. */
const lockById = (id, executor) => executor.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [id]);

module.exports = {
  findById,
  findByEmail,
  create,
  updateProfile,
  lockById,
  findDoctors,
  findDoctorById,
  findPatientsOfDoctor,
  findPatientOfDoctor,
};
