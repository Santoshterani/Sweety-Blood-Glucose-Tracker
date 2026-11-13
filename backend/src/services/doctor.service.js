// What a doctor can see: only the patients who chose them.
const config = require('../config');
const userRepository = require('../repositories/user.repository');
const readingRepository = require('../repositories/reading.repository');
const reportsService = require('./reports.service');
const { HttpError } = require('../utils/httpError');
const { addDays, todayInTimezone } = require('../utils/dates');
const { toProfile } = require('../utils/profile');
const { SLOT_LABELS } = require('../utils/slots');

/** A patient who isn't yours looks exactly like one that doesn't exist: 404. */
async function assertPatient(doctorId, patientId) {
  const patient = await userRepository.findPatientOfDoctor(doctorId, patientId);
  if (!patient) throw new HttpError(404, 'Patient not found.');
  return patient;
}

/** The patient details a doctor needs (no password hash, no emergency contact). */
function toPatientView(row) {
  const p = toProfile(row);
  return {
    id: p.id,
    name: p.name,
    email: p.email,
    phone: p.phone,
    age: p.age,
    sex: p.sex,
    heightCm: p.heightCm,
    weightKg: p.weightKg,
    bmi: p.bmi,
    diabetesType: p.diabetesType,
    diagnosedYear: p.diagnosedYear,
    medication: p.medication,
    targetLow: p.targetLow,
    targetHigh: p.targetHigh,
  };
}

/** Every assigned patient with their last 7 days at a glance. */
async function listPatients(doctorId) {
  const patients = await userRepository.findPatientsOfDoctor(doctorId);
  const ids = patients.map((p) => p.id);
  const to = todayInTimezone(config.timezone);
  const from = addDays(to, -6);

  const [stats, latest] = await Promise.all([
    readingRepository.summarizeByUser(ids, from, to),
    readingRepository.findLatestByUser(ids),
  ]);
  const statsById = new Map(stats.map((s) => [s.user_id, s]));
  const latestById = new Map(latest.map((l) => [l.user_id, l]));

  return {
    period: { from, to },
    patients: patients.map((row) => {
      const s = statsById.get(row.id);
      const l = latestById.get(row.id);
      return {
        ...toPatientView(row),
        week: {
          count: s ? s.count : 0,
          average: s ? s.average : null,
          highest: s ? s.highest : null,
          lowest: s ? s.lowest : null,
          inRangePercent: s ? Math.round((s.in_range / s.count) * 100) : null,
        },
        lastReading: l ? { date: l.reading_date, slot: l.slot, slotLabel: SLOT_LABELS[l.slot], value: l.value } : null,
      };
    }),
  };
}

async function getPatient(doctorId, patientId) {
  return toPatientView(await assertPatient(doctorId, patientId));
}

async function getPatientReport(doctorId, patientId, type, params) {
  await assertPatient(doctorId, patientId);
  return reportsService.getReport(patientId, type, params);
}

async function getPatientReportPdf(doctorId, patientId, type, params) {
  await assertPatient(doctorId, patientId);
  return reportsService.getReportPdf(patientId, type, params);
}

module.exports = { listPatients, getPatient, getPatientReport, getPatientReportPdf };
