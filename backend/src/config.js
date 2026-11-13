require('dotenv').config({ quiet: true });

const config = {
  port: Number(process.env.PORT) || 4000,
  databaseUrl: process.env.DATABASE_URL || 'postgres://sweety:sweety@localhost:5432/sweety',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  timezone: process.env.APP_TIMEZONE || 'Asia/Kolkata',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  queuePrefix: process.env.QUEUE_PREFIX || 'sweety',
  reminders: {
    // Off by default so the API starts without Redis. Turn on with REMINDERS_ENABLED=true.
    enabled: process.env.REMINDERS_ENABLED === 'true',
    // When the daily job runs, in APP_TIMEZONE. Default: every day at 8 pm.
    cron: process.env.REMINDER_CRON || '0 20 * * *',
  },
};

if (process.env.NODE_ENV === 'production' && config.jwtSecret === 'dev-only-secret') {
  throw new Error('JWT_SECRET must be set in production');
}

module.exports = config;
