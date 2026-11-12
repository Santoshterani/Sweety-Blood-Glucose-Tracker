const fs = require('fs');
const path = require('path');
const db = require('./db');

// Columns added to `users` after the first release. A database made by an older version
// doesn't get them from CREATE TABLE IF NOT EXISTS, so we add whatever is missing.
const USER_COLUMNS = [
  ['phone', 'VARCHAR(30) NULL'],
  ['date_of_birth', 'DATE NULL'],
  ['sex', 'VARCHAR(10) NULL'],
  ['height_cm', 'SMALLINT UNSIGNED NULL'],
  ['weight_kg', 'DECIMAL(5,1) NULL'],
  ['diabetes_type', 'VARCHAR(20) NULL'],
  ['diagnosed_year', 'SMALLINT UNSIGNED NULL'],
  ['medication', 'VARCHAR(255) NULL'],
  ['target_low', 'SMALLINT UNSIGNED NOT NULL DEFAULT 70'],
  ['target_high', 'SMALLINT UNSIGNED NOT NULL DEFAULT 180'],
  ['doctor_name', 'VARCHAR(100) NULL'],
  ['doctor_phone', 'VARCHAR(30) NULL'],
  ['emergency_contact', 'VARCHAR(255) NULL'],
];

/** Runs schema.sql statement by statement (MySQL runs one statement per query by default). */
async function applySchema() {
  const sql = fs
    .readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8')
    .replace(/--.*$/gm, ''); // strip comments
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await db.query(statement);
  }

  const { rows } = await db.query(
    `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`
  );
  const existing = new Set(rows.map((r) => r.name.toLowerCase()));
  for (const [name, definition] of USER_COLUMNS) {
    if (!existing.has(name)) {
      await db.query(`ALTER TABLE users ADD COLUMN ${name} ${definition}`);
    }
  }
}

module.exports = applySchema;
