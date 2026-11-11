# Sweety – Blood Glucose Tracker

A small app where a diabetes patient records up to 4 blood glucose readings a day (mg/dl) and views daily,
month-to-date and monthly reports.

**Stack:** Node.js + Express · PostgreSQL · React (Vite) + MUI

```
sweety/
├── backend/            Express API + PostgreSQL schema + tests   (Phase 1)
├── frontend/           React + MUI app                            (Phase 2)
└── docker-compose.yml  PostgreSQL for local development
```

## Running it

### 1. Database

Either use Docker:

```bash
docker compose up -d
```

or use any PostgreSQL 14+ you already have and create a database called `sweety`.

### 2. Backend

```bash
cd backend
cp .env.example .env          # adjust DATABASE_URL / JWT_SECRET if needed
npm install
npm run db:init               # creates the tables from schema.sql (safe to re-run)
npm run dev                   # API on http://localhost:4000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173  (calls to /api are proxied to the backend on :4000)
```

Open http://localhost:5173, sign up, then use **Add reading**. The page shows three report cards for the
selected **Report date**: Daily (with each reading and its edit / delete buttons), Month-to-date and
Monthly (previous month). Each shows an empty state when there are no readings.

### 4. Tests

Tests run against a **real PostgreSQL database** called `sweety_test`
(override with `TEST_DATABASE_URL`). Create it once, then:

```bash
createdb sweety_test          # or: docker exec -it sweety-db createdb -U sweety sweety_test
cd backend && npm test
```

The suite wipes the tables in that test database before each test, so never point it at real data.

## API (Phase 1)

All errors look like `{ "error": "message", "errors": { "field": "message" } }` (`errors` only for field problems).
Every route except signup/login needs `Authorization: Bearer <token>`.

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/auth/signup` | `{ name, email, password }` → `{ token, user }` |
| POST | `/api/auth/login` | `{ email, password }` → `{ token, user }` |
| GET | `/api/auth/me` | Current user (restores a session) |
| GET | `/api/slots` | The 4 time slots (value + label) |
| GET | `/api/readings?date=&page=&limit=` | Your readings, newest day first (paginated) |
| POST | `/api/readings` | `{ date, slot, value }` |
| PUT | `/api/readings/:id` | Edit a reading (same rules as create) |
| DELETE | `/api/readings/:id` | Delete a reading |
| GET | `/api/reports/daily?date=` | That day: highest / lowest / average / count + each reading |
| GET | `/api/reports/month-to-date?date=` | 1st of the month → selected date |
| GET | `/api/reports/monthly?date=` | The whole **previous** month |

Slots: `morning` (Morning (fasting)), `after_breakfast`, `after_lunch`, `after_dinner`.

## How the rules are enforced

| Rule | Where |
|---|---|
| Value required; whole number 40–600 | API validation (`utils/validation.js`) + DB `CHECK` |
| One reading per slot per day | API check + DB `UNIQUE (user_id, reading_date, slot)` |
| Max 4 readings per day | API check inside a transaction |
| Date not in the future | API validation |
| Passwords | Hashed with bcrypt (10 rounds); only the hash is stored |
| Users only see their own data | Every query filters by the id inside the JWT |

Concurrent requests are handled: writes happen in a transaction that locks the user's row, so two simultaneous
"add" requests cannot both slip past the rules (there is a test for it).

## Assumptions

1. **"Today" uses a fixed timezone** (`APP_TIMEZONE`, default `Asia/Kolkata`), not the server's clock, so a patient
   logging a reading just after midnight is not told their date is "in the future". Dates are plain
   `YYYY-MM-DD` values with no time component.
2. **Order of checks on add:** if the day already has 4 readings the message is *"You can add only 4 readings per day."*;
   otherwise a repeated slot gives *"You already have an After lunch reading for this date."*
   With only 4 slots, a full day can only be hit by repeating a slot, so checking "max 4" first is the only way
   the max-4 message is ever shown. Both rules are still enforced independently.
3. **Editing** a reading follows the same rules as adding one. Moving a reading to another date counts against
   that date's limit; saving a reading without changing its slot is not treated as a duplicate of itself.
4. **Value validation message:** anything that is not a whole number in range (e.g. `120.5`, `abc`, `700`)
   gets *"Value must be between 40 and 600 mg/dl."*
5. **Reports:** the selected date defaults to today and cannot be in the future. "Monthly" always means the month
   *before* the selected date's month (selected 15 Oct → 1–30 Sep). Averages are rounded half-up to 1 decimal.
   With no readings the API returns `count: 0` and `null` for highest/lowest/average (the UI shows an empty state).
6. **Deleting** a reading has no undo; the UI asks for confirmation first.
7. **Login sessions** are JWTs valid for 7 days, kept in the browser's `localStorage`. There is no password reset
   or email verification (out of scope for this assignment).
8. Someone else's reading id returns **404**, not 403, so ids can't be probed.

9. **Frontend validation** repeats the server's rules for instant feedback, and any rule only the server can
   check (duplicate slot, max 4 per day) is shown under the matching field of the form. The date picker's
   "today" comes from the browser's clock; the server's check (Asia/Kolkata) is the final judge.
10. **One screen for everything:** edit and delete live on the Daily report's reading list, so to change an
    older reading, pick its date in **Report date**. After saving, the page jumps to the date that was saved.
11. The Phase 2 frontend has no automated tests (they were an optional bonus); the API is covered by the backend suite.

## Bonus tasks done

- Pagination on `GET /api/readings`
- `docker-compose.yml` for PostgreSQL
