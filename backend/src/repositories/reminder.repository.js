// All SQL for the `reminder_logs` table.
const db = require('../db');

/**
 * In ONE statement: find every patient with fewer than `max` readings on `date`, write a reminder
 * row for each, and return who was logged. Patients already logged for `date` are skipped
 * (ON CONFLICT), so running the job twice is harmless.
 */
const logPatientsBelow = async (date, max, executor = db) => {
  const { rows } = await executor.query(
    `WITH counts AS (
       SELECT u.id AS user_id, u.name, COALESCE(c.n, 0)::int AS readings_count
       FROM users u
       LEFT JOIN (
         SELECT user_id, COUNT(*) AS n FROM readings WHERE reading_date = $1 GROUP BY user_id
       ) c ON c.user_id = u.id
       WHERE u.role = 'patient'
     ),
     inserted AS (
       INSERT INTO reminder_logs (user_id, reminder_date, readings_count)
       SELECT user_id, $1, readings_count FROM counts WHERE readings_count < $2
       ON CONFLICT (user_id, reminder_date) DO NOTHING
       RETURNING user_id, readings_count
     )
     SELECT i.user_id, c.name, i.readings_count FROM inserted i JOIN counts c USING (user_id)
     ORDER BY i.user_id`,
    [date, max]
  );
  return rows;
};

const findRecentForUser = async (userId, limit, executor = db) => {
  const { rows } = await executor.query(
    `SELECT id, reminder_date, readings_count, created_at FROM reminder_logs
     WHERE user_id = $1 ORDER BY reminder_date DESC LIMIT $2`,
    [userId, limit]
  );
  return rows;
};

module.exports = { logPatientsBelow, findRecentForUser };
