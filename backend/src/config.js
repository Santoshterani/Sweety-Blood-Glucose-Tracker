require('dotenv').config({ quiet: true });

const config = {
  port: Number(process.env.PORT) || 4000,
  databaseUrl: process.env.DATABASE_URL || 'postgres://sweety:sweety@localhost:5432/sweety',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  timezone: process.env.APP_TIMEZONE || 'Asia/Kolkata',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
};

if (process.env.NODE_ENV === 'production' && config.jwtSecret === 'dev-only-secret') {
  throw new Error('JWT_SECRET must be set in production');
}

module.exports = config;
