
const dbPool = require('./db/pool');

module.exports = {
  // PostgreSQL query
  query: async (sql, params = []) => {
    const result = await dbPool.query(sql, params);

    return {
      rows: result.rows,
      rowCount: result.rowCount,
      insertId: null,
    };
  },

  // Transaction-compatible client
  getClient: async () => {
    const client = await dbPool.pool.connect();

    return {
      query: async (sql, params = []) => {
        const result = await client.query(sql, params);

        return {
          rows: result.rows,
          rowCount: result.rowCount,
          insertId: null,
        };
      },

      release: () => client.release(),
    };
  },

  pool: dbPool.pool,

  // Expose existing PostgreSQL transaction utilities
  withTransaction: dbPool.withTransaction,
  isUniqueViolation: dbPool.isUniqueViolation,
};
