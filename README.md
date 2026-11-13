# Sweety – Blood Glucose Tracker

Sweety is a small web app for people with diabetes. You log up to four blood glucose readings a day (in mg/dl), see
how the week is going on a dashboard, browse everything in a table, and get daily / weekly / monthly / yearly / custom
reports you can download as a PDF. Doctors can have their own account and look at the reports of patients who chose
them. A background job keeps a daily log of who hasn't finished their four readings.

**Built with:** Node.js, Express, PostgreSQL, Joi, BullMQ (Redis), React (Vite) and MUI.

```
sweety-postgres/
├── backend/            the API, database schema, PDF export, background job, tests
├── frontend/           the React app
└── docker-compose.yml  PostgreSQL and Redis for local development
```

## What you need first

- Node.js 20 or newer (built and tested on 22)
- PostgreSQL 13 or newer (Docker is the easiest way, but your own install is fine)
- Redis, only if you want the daily reminder job (it is off by default)

## 1. Install

```bash
cd backend
npm install
cp .env.example .env      # on Windows: copy .env.example .env

cd ../frontend
npm install
```

Open `backend/.env` and change `JWT_SECRET` to any long random string. The other defaults work for a local setup.

## 2. Set up the database

**Option A: Docker** (from the project root)

```bash
docker compose up -d
```

This starts PostgreSQL with the user, password and database already matching `.env.example`.

**Option B: your own PostgreSQL**

```sql
CREATE ROLE sweety LOGIN PASSWORD 'sweety';
CREATE DATABASE sweety OWNER sweety;
CREATE DATABASE sweety_test OWNER sweety;   -- used by the tests
```

If you use different credentials, edit `DATABASE_URL` in `backend/.env`
(format: `postgres://user:password@host:5432/database`).

**Using a named schema** (for example `blood_sugar` instead of `public`)? Tell Postgres to use it by adding this to the
end of the URL:

```
DATABASE_URL=postgres://user:password@localhost:5432/postgres?options=-c%20search_path%3Dblood_sugar
```

**Creating the tables:** you don't have to do it by hand. Run this once (it's safe to run again):

```bash
cd backend
npm run db:init
```

The server also applies the same schema every time it starts. If you already have an older version of Sweety, it adds
the new columns and tables without touching your data.

## 3. Run the server

```bash
cd backend
npm run dev        # API on http://localhost:4000, restarts when you edit code
# or: npm start    # plain start, no auto-restart
```

Check it with <http://localhost:4000/api/health>.

## 4. Run the client

```bash
cd frontend
npm run dev        # http://localhost:5173
```

The client sends anything under `/api` to the server on port 4000, so there is nothing else to configure. Open
<http://localhost:5173>, create an account and start adding readings. To try the doctor side, sign up a second account
and pick **Doctor**, then, as the patient, choose that doctor under Profile → "My doctor on Sweety".

For a production build use `npm run build` in `frontend`.

## 5. Run the tests

```bash
cd backend
npm test
```

The tests use a real PostgreSQL database called `sweety_test` (change it with `TEST_DATABASE_URL`). They **wipe the
tables in that database**, so never point it at real data. There are 127 tests covering validation, reports, roles,
doctor access, reminders, the PDF and the database upgrade. The one test that needs Redis skips itself if Redis isn't
running.

## Daily reminders (optional)

Every evening at 20:00 (in `APP_TIMEZONE`) a BullMQ job writes one log row for each patient with fewer than 4 readings
that day. Patients see the latest entries on their dashboard. It only keeps a log; it doesn't send email or SMS.

1. Start Redis: `docker compose up -d redis` (on Windows without Docker, use WSL or Memurai).
2. In `backend/.env` set `REMINDERS_ENABLED=true`, then start the server as usual.
3. Prefer a separate process? Keep it `false` on the API and run `npm run worker` in another terminal.
4. Want to see it work right now? `npm run reminders:run` runs the job once and needs no Redis
   (add `-- 2026-11-12` to run it for a specific date).

If Redis is down the API still starts and just logs a warning.

## How the backend is organised

Each request goes through the same steps, and each step has one job:

```
route → middleware → controller → validator (Joi) → service → repository → PostgreSQL
```

- **Routes** map a URL to a controller and attach middleware (`requireAuth`, `requireRole`).
- **Controllers** are thin: read the request, validate it, call a service, send the answer.
- **Validators** (Joi) clean the input and return the exact error messages the screens show.
- **Services** hold the business rules: max 4 a day, one per slot, transactions, passwords, tokens, reports.
- **Repositories** are the only place with SQL.

Code lives in `backend/src` (`routes`, `middleware`, `controllers`, `validators`, `services`, `repositories`, `jobs`,
`db`, `utils`).

## API at a glance

Errors look like `{ "error": "message", "errors": { "field": "message" } }`. Everything except signup and login needs an
`Authorization: Bearer <token>` header.

| Method | Route | Who | What it does |
|---|---|---|---|
| POST | `/api/auth/signup` | anyone | `{ name, email, password, role? }` (`patient` by default, or `doctor`) |
| POST | `/api/auth/login` | anyone | `{ email, password }` → token and user |
| GET | `/api/auth/me` | any | the logged-in user |
| GET | `/api/slots` | anyone | the 4 time slots |
| GET / POST | `/api/readings` | patient | list (paginated, `date`, `slot` filters) / add `{ date, slot, value }` |
| PUT / DELETE | `/api/readings/:id` | patient | edit / delete a reading |
| GET | `/api/dashboard` | patient | everything the home screen needs |
| GET | `/api/reports/:type` | patient | `daily`, `weekly`, `monthly`, `yearly`, `month-to-date` or `custom` |
| GET | `/api/reports/pdf?type=…` | patient | the same report as a PDF |
| GET / PUT | `/api/profile` | any | profile (patients can set `doctorId`) |
| GET | `/api/reminders` | patient | latest daily reminder log entries |
| GET | `/api/doctors` | patient | doctors to choose from |
| GET | `/api/doctor/patients` | doctor | assigned patients with a 7-day summary |
| GET | `/api/doctor/patients/:id` | doctor | one patient's details |
| GET | `/api/doctor/patients/:id/reports/:type` | doctor | that patient's report (and `/reports/pdf` for the PDF) |

## Notes

### Assumptions I made

- **"Today" follows a fixed timezone** (`APP_TIMEZONE`, default `Asia/Kolkata`), not the server clock, so a reading
  logged just after midnight isn't rejected as "in the future". Dates are plain `YYYY-MM-DD`.
- **Order of checks when adding:** if a day already has 4 readings you get "You can add only 4 readings per day."; otherwise
  a repeated slot gets "You already have an After lunch reading for this date." (With only 4 slots, the first message
  could never appear if the slot check ran first.) Editing follows the same rules.
- **Any value that isn't a whole number from 40 to 600** (like `120.5` or `abc`) gets one message:
  "Value must be between 40 and 600 mg/dl."
- **Report periods:** weekly is the last 7 days, monthly is the month *before* the chosen date (15 Oct → September), yearly
  is year-to-date. Averages round half-up to 1 decimal.
- **Target range** defaults to 70–180 mg/dl and can be changed in Profile. It drives the In range / High / Low labels
  and the chart colours. Colour is never the only signal; every label is also text.
- **A patient's choice of doctor is their consent.** A doctor only sees patients who chose them, and an id that isn't
  theirs returns 404, not 403, so ids can't be guessed. Doctors are read-only.
- **Doctor sign-up is open** to keep the demo self-contained.
- **Sessions** are JWTs valid for 7 days, stored in the browser's `localStorage`. There is no password reset or email
  verification.
- **Reminders are opt-in** because they need Redis, and they only write a log.
- Deleting a reading can't be undone; the UI asks first.
- Profile and Login/Readings use two label styles (compact uppercase on Profile, roomier on the newer forms), and
  `frontend/public/glucose-care.svg` isn't used by any screen.

### What I'd improve with more time

- **Verify doctors** (invite code or admin approval) and let a patient share with more than one doctor, with a clear
  "who can see my data" page.
- **Send the reminders for real** (email, SMS or push) and let each patient choose the time or switch them off.
- **Password reset, email verification and refresh tokens** kept in httpOnly cookies instead of `localStorage`; rate
  limiting on login.
- **Frontend tests** (component tests plus a few Playwright flows) and CI that runs everything on each push. Right now
  the API is covered by the backend suite and the screens were checked by hand and with a browser script.
- **Proper migrations** (a tool like node-pg-migrate) instead of the idempotent `schema.sql`, plus Docker images for the
  API and client.
- **Accessibility pass** on the Profile dropdowns (they have no accessible name for screen readers), and a dark mode.
- **Smarter insights:** highlight patterns (high mornings, missed slots) and let doctors leave notes or comments.
- **Time zone per user**, rather than one for the whole app.
