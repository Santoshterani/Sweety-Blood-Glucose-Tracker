const config = require('../config');

/**
 * Redis connection options for BullMQ, built from REDIS_URL (redis://[:password@]host:port[/db],
 * or rediss:// for TLS). BullMQ opens its own connections from these.
 */
function redisConnection(url = config.redisUrl) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port) || 6379,
    username: u.username ? decodeURIComponent(u.username) : undefined,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    db: u.pathname.length > 1 ? Number(u.pathname.slice(1)) : undefined,
    ...(u.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}

module.exports = { redisConnection };
