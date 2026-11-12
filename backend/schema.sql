-- Sweety database schema (PostgreSQL 13+)
-- Safe to run more than once. The ALTER TABLE ... ADD COLUMN IF NOT EXISTS lines upgrade a
-- database created by an older version of Sweety without touching its data.

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,   -- always stored lower-case
  password_hash VARCHAR(100) NOT NULL,          -- bcrypt hash, never plain text
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Patient profile (all optional except the target range, which has defaults)
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone             VARCHAR(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth     DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sex               VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS height_cm         SMALLINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS weight_kg         NUMERIC(5,1);
ALTER TABLE users ADD COLUMN IF NOT EXISTS diabetes_type     VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS diagnosed_year    SMALLINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS medication        VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS target_low        SMALLINT NOT NULL DEFAULT 70;
ALTER TABLE users ADD COLUMN IF NOT EXISTS target_high       SMALLINT NOT NULL DEFAULT 180;
ALTER TABLE users ADD COLUMN IF NOT EXISTS doctor_name       VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS doctor_phone      VARCHAR(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(255);

CREATE TABLE IF NOT EXISTS readings (
  id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reading_date DATE NOT NULL,
  slot         VARCHAR(20) NOT NULL,
  value        INTEGER NOT NULL,                -- mg/dl
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_readings_slot  CHECK (slot IN ('morning', 'after_breakfast', 'after_lunch', 'after_dinner')),
  CONSTRAINT chk_readings_value CHECK (value BETWEEN 40 AND 600),
  -- Safety net: the API checks this too, but the database has the final say.
  -- (This index also speeds up lookups by user and date.)
  CONSTRAINT one_reading_per_slot_per_day UNIQUE (user_id, reading_date, slot)
);
