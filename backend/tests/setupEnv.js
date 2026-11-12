// Runs before every test file, before any app code is loaded.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://sweety:sweety@localhost:5432/sweety_test';
process.env.JWT_SECRET = 'test-secret';
process.env.BCRYPT_ROUNDS = '4'; // fast hashing in tests
process.env.APP_TIMEZONE = 'Asia/Kolkata';
