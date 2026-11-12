const config = require('../config');
const { ageOn, todayInTimezone } = require('./dates');

/** Turns a `users` row into the object the API returns (camelCase, with age and BMI worked out). */
function toProfile(row) {
  const today = todayInTimezone(config.timezone);
  const weightKg = row.weight_kg === null || row.weight_kg === undefined ? null : Number(row.weight_kg);
  const heightCm = row.height_cm ?? null;
  const bmi = weightKg && heightCm ? Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10 : null;

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? null,
    dateOfBirth: row.date_of_birth ?? null,
    age: row.date_of_birth ? ageOn(row.date_of_birth, today) : null,
    sex: row.sex ?? null,
    heightCm,
    weightKg,
    bmi,
    diabetesType: row.diabetes_type ?? null,
    diagnosedYear: row.diagnosed_year ?? null,
    medication: row.medication ?? null,
    targetLow: row.target_low ?? 70,
    targetHigh: row.target_high ?? 180,
    doctorName: row.doctor_name ?? null,
    doctorPhone: row.doctor_phone ?? null,
    emergencyContact: row.emergency_contact ?? null,
  };
}

module.exports = { toProfile };
