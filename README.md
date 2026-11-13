# Sweety – Blood Glucose Tracker (PostgreSQL version)

A small web app where a diabetes patient records up to 4 blood glucose readings a day (mg/dl), sees them on a
dashboard, browses them in a paginated table, and views daily / weekly / monthly / yearly / custom-range reports that
can be exported to PDF. A profile page holds the patient's details.

**Stack:** Node.js + Express · PostgreSQL 13+ · Joi · React (Vite) + MUI

```
sweety-postgres/
├── backend/            Express API, schema, PDF export, tests
├── frontend/           React + MUI app
└── docker-compose.yml  PostgreSQL for local development
```

## Screens

| Screen | What it does |
|---|---|
| Dashboard | Today's 4 slots, 7-day summary (average / highest / lowest / % in target range), 14-day trend, recent readings |
| Readings | Paginated table (10 per page, slot filter, edit, delete) with the **Add reading** form beside it |
| Reports | Tabs: **Daily · Weekly · Monthly · Yearly · Custom** (own start and end dates, plus quick ranges). Highest / lowest / average / count, a chart and a breakdown table. **Export PDF** button |
| Profile | Patient details: name, email, phone, date of birth, sex, height, weight, diabetes type, year diagnosed, medication, target range, doctor, emergency contact |

## Running it

### 1. Database

Either use Docker:

```bash
docker compose up -d
```

or use the PostgreSQL (13 or newer) you already have and create the database and user:

```sql
CREATE ROLE sweety LOGIN PASSWORD 'sweety';
CREATE DATABASE sweety OWNER sweety;
CREATE DATABASE sweety_test OWNER sweety;
```

If you change the user, password, host or port, update `DATABASE_URL` in `backend/.env`
(format: `postgres://user:password@host:5432/database`).

### 2. Backend

```bash
cd backend
cp .env.example .env          # adjust DATABASE_URL / JWT_SECRET if needed
npm install
npm run db:init               # creates the tables (safe to re-run)
npm run dev                   # API on http://localhost:4000
```

The API also applies `schema.sql` at startup, creating or upgrading the tables before accepting requests.

`npm run db:init` also **upgrades an older database**: if you already ran an earlier version of Sweety, it adds the
new patient-profile columns to your existing `users` table (`ADD COLUMN IF NOT EXISTS`) and keeps your data.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173  (calls to /api are proxied to the backend on :4000)
```

### 4. Tests

Tests run against a **real PostgreSQL database** called `sweety_test` (override with `TEST_DATABASE_URL`):

```bash
cd backend && npm test
```

The suite wipes the tables in that test database, so never point it at real data. It covers the validation rules,
date ranges, report breakdowns, profile, dashboard, PDF export and the database upgrade (96 tests).

## Backend structure

Every request travels through the same layers, and each layer has one job:

```
route  →  middleware  →  controller  →  validator (Joi)  →  service  →  repository  →  PostgreSQL
```

| Layer | Folder | Job |
|---|---|---|
| Route | `src/routes/` | Maps a URL + method to a controller; attaches middleware such as `requireAuth` |
| Middleware | `src/middleware/` | Cross-cutting work: JWT check (`auth.js`), 404 and error formatting (`errorHandler.js`) |
| Controller | `src/controllers/` | Thin: reads the request, calls the validator, calls a service, sends the response |
| Validator | `src/validators/` | **Joi** schemas. Clean the input (trim, lower-case, numbers as numbers) and return the exact error messages the UI shows |
| Service | `src/services/` | Business rules: max 4 per day, one per slot, transactions and locking, bcrypt, JWT, report building |
| Repository | `src/repositories/` | The only place with SQL. Takes an optional transaction client |

Supporting code: `src/db/` (pg pool, `withTransaction`, schema runner), `src/utils/` (dates, stats, report builder,
PDF renderer, mappers). Services never write SQL and repositories never make business decisions, so a rule changes in
one place and a query changes in one place.

```
backend/src
├── routes/        auth · readings · reports · profile · dashboard
├── middleware/    auth · errorHandler
├── controllers/   auth · readings · reports · profile · dashboard
├── validators/    auth · readings · reports · profile  (+ common, validate)
├── services/      auth · readings · reports · profile · dashboard
├── repositories/  user · reading
├── db/            pool · init
└── utils/         dates · stats · slots · reportBuilder · pdfReport · mappers · profile · httpError
```

## API

All errors look like `{ "error": "message", "errors": { "field": "message" } }` (`errors` only for field problems).
Every route except signup/login needs `Authorization: Bearer <token>`.

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/auth/signup` | `{ name, email, password }` → `{ token, user }` |
| POST | `/api/auth/login` | `{ email, password }` → `{ token, user }` |
| GET | `/api/auth/me` | Current user's profile (restores a session) |
| GET | `/api/slots` | The 4 time slots (value + label) |
| GET | `/api/readings?date=&slot=&page=&limit=` | Your readings, newest day first (paginated) |
| POST | `/api/readings` | `{ date, slot, value }` |
| PUT | `/api/readings/:id` | Edit a reading (same rules as create) |
| DELETE | `/api/readings/:id` | Delete a reading |
| GET | `/api/dashboard` | Everything the home screen shows, in one call |
| GET | `/api/reports/:type` | `type` = `daily`, `weekly`, `monthly`, `yearly`, `month-to-date` or `custom` (see below) |
| GET | `/api/reports/pdf?type=…` | The same report as an A4 PDF download |
| GET | `/api/profile` | Patient profile (with age and BMI worked out) |
| PUT | `/api/profile` | Save the profile form |

### Report types

| Type | Query | Period | Breakdown |
|---|---|---|---|
| `daily` | `?date=` | that day (also lists each reading with its slot) | per reading |
| `weekly` | `?date=` | the 7 days ending on that date | per day |
| `monthly` | `?date=` | the whole **previous** month | per week |
| `yearly` | `?date=` | 1 January → that date | per month |
| `month-to-date` | `?date=` | 1st of the month → that date | per week |
| `custom` | `?from=&to=` | any range you choose | per day (≤ 14 days), per week (≤ 92 days), else per month |

`date` defaults to today. Every report returns `count`, `highest`, `lowest`, `average` (1 decimal) and `buckets`.
With no readings the numbers are `null` and the UI shows a friendly empty state.

## How the rules are enforced

| Rule | Where |
|---|---|
| Value required; whole number 40–600 | Joi validator + DB `CHECK` |
| One reading per slot per day | Service check + DB `UNIQUE (user_id, reading_date, slot)` |
| Max 4 readings per day | Service check inside a transaction |
| Date not in the future | API validation (reading dates, report dates and custom ranges) |
| Custom range | start and end required, start ≤ end, not in the future, at most 5 years |
| Passwords | Hashed with bcrypt (10 rounds); only the hash is stored |
| Users only see their own data | Every query filters by the id inside the JWT |

Concurrent requests are handled: writes happen in a transaction that locks the user's row (`SELECT … FOR UPDATE`), so two simultaneous
"add" requests cannot both slip past the rules (there is a test for it).

## Assumptions

1. **"Today" uses a fixed timezone** (`APP_TIMEZONE`, default `Asia/Kolkata`), not the server's clock, so a patient
   logging a reading just after midnight is not told their date is "in the future". Dates are plain `YYYY-MM-DD`
   values with no time component.
2. **Order of checks on add:** if the day already has 4 readings the message is *"You can add only 4 readings per day."*;
   otherwise a repeated slot gives *"You already have an After lunch reading for this date."* With only 4 slots, a full
   day can only be hit by repeating a slot, so checking "max 4" first is the only way the max-4 message is ever shown.
3. **Editing** follows the same rules as adding. Moving a reading to another date counts against that date's limit;
   saving a reading without changing its slot is not a duplicate of itself.
4. **Value validation message:** anything that is not a whole number in range (e.g. `120.5`, `abc`, `700`) gets
   *"Value must be between 40 and 600 mg/dl."*
5. **Report periods:** *Weekly* is the last 7 days (not Monday–Sunday). *Monthly* is the month **before** the selected
   date, as in the original brief (selected 15 Oct → 1–30 Sep). *Yearly* is year-to-date. Averages are rounded half-up
   to 1 decimal. The last week in a "per week" breakdown is cut off at the end of the range.
6. **Target range** defaults to 70–180 mg/dl and can be changed on the Profile page. It decides the "In range / High /
   Low" labels, the chart colours (colour is never the only signal, every label is also text) and the "% in target range".
7. **PDF export** is made on the server (pdfkit) from the same data as the screen, so the two always match. It includes
   the patient's details from the profile. It is for information only and says so in the footer.
8. **Profile fields are all optional** except name and email. Empty optional fields are stored as `NULL`.
   Age and BMI are worked out, never stored.
9. **Deleting** a reading has no undo; the UI asks for confirmation first.
10. **Login sessions** are JWTs valid for 7 days, kept in the browser's `localStorage`. There is no password reset or
    email verification (out of scope).
11. Someone else's reading id returns **404**, not 403, so ids can't be probed.
12. **Frontend tests** were an optional bonus and are not included; the API is covered by the backend suite and the whole
    flow was exercised in a real browser while building.

## Bonus tasks done

- Pagination on `GET /api/readings` (and in the Readings table)
- Charts: trend line on the dashboard, bar charts on reports (hand-drawn SVG, no extra library)
- `docker-compose.yml` for PostgreSQL
- PDF export
