const db = require('../db');
const userRepository = require('../repositories/user.repository');
const readingRepository = require('../repositories/reading.repository');
const { HttpError } = require('../utils/httpError');
const { SLOT_LABELS, MAX_READINGS_PER_DAY } = require('../utils/slots');
const { toReading } = require('../utils/mappers');

const withArticle = (label) => `${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label}`;

/**
 * Rules that need the database. Must run inside a transaction that holds the user lock.
 * `excludeId` lets an edit ignore the reading being edited.
 *
 * Order matters: a full day is reported as "max 4 per day" before the per-slot check,
 * otherwise (with only 4 slots) the max-4 rule could never be reached.
 */
async function assertDayRules(client, userId, { date, slot }, excludeId = null) {
  const sameDay = await readingRepository.findByDay(userId, date, excludeId, client);

  if (sameDay.length >= MAX_READINGS_PER_DAY) {
    const message = `You can add only ${MAX_READINGS_PER_DAY} readings per day.`;
    throw new HttpError(409, message, { date: message });
  }
  if (sameDay.some((r) => r.slot === slot)) {
    const message = `You already have ${withArticle(SLOT_LABELS[slot])} reading for this date.`;
    throw new HttpError(409, message, { slot: message });
  }
}

/**
 * Runs `work(client)` in a transaction that first locks the user's row, so two simultaneous
 * requests can't both slip past the rules.
 */
async function inUserTransaction(userId, work) {
  try {
    return await db.withTransaction(async (client) => {
      await userRepository.lockById(userId, client);
      return work(client);
    });
  } catch (err) {
    // Last line of defence: the database UNIQUE constraint caught a duplicate we somehow missed.
    if (db.isUniqueViolation(err)) {
      const message = 'You already have a reading for this slot and date.';
      throw new HttpError(409, message, { slot: message });
    }
    throw err;
  }
}

async function list(userId, { date, slot, page, limit }) {
  const filter = { userId, date, slot };
  const [total, rows] = await Promise.all([
    readingRepository.count(filter),
    readingRepository.findPage(filter, { limit, offset: (page - 1) * limit }),
  ]);
  return {
    data: rows.map(toReading),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

async function create(userId, data) {
  const row = await inUserTransaction(userId, async (client) => {
    await assertDayRules(client, userId, data);
    return readingRepository.insert({ userId, ...data }, client);
  });
  return toReading(row);
}

async function update(userId, id, data) {
  const row = await inUserTransaction(userId, async (client) => {
    // Only the owner can edit; someone else's id looks exactly like a missing one.
    if (!(await readingRepository.existsForUser(id, userId, client))) throw new HttpError(404, 'Reading not found.');
    await assertDayRules(client, userId, data, id);
    return readingRepository.update(id, userId, data, client);
  });
  return toReading(row);
}

async function remove(userId, id) {
  if (!(await readingRepository.remove(id, userId))) throw new HttpError(404, 'Reading not found.');
}

module.exports = { list, create, update, remove };
