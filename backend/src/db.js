const mysql = require('mysql2/promise');
const config = require('./config');

const pool = mysql.createPool({
  uri: config.databaseUrl,
  // By default DATE columns become JS Date objects, which silently shift by timezone.
  // We keep them as plain 'YYYY-MM-DD' strings instead.
  dateStrings: ['DATE'],
  waitForConnections: true,
  connectionLimit: 10,
});

/**
 * mysql2 returns [rowsOrResultHeader, fields]. We reshape it so the rest of the app can use
 * the same { rows, rowCount, insertId } result for every kind of statement:
 *   SELECT            -> rows = [...]
 *   INSERT/UPDATE/... -> rowCount = affected rows, insertId = new auto-increment id
 */
function shape([data]) {
  if (Array.isArray(data)) return { rows: data, rowCount: data.length, insertId: null };
  return { rows: [], rowCount: data.affectedRows, insertId: data.insertId };
}

module.exports = {
  query: async (sql, params) => shape(await pool.query(sql, params)),
  // Used for transactions: const client = await db.getClient(); ... client.release()
  getClient: async () => {
    const connection = await pool.getConnection();
    return {
      query: async (sql, params) => shape(await connection.query(sql, params)),
      release: () => connection.release(),
    };
  },
  pool,
};
