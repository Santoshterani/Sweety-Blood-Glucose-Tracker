const readingsService = require('../services/readings.service');
const { validateReading, validateListQuery, validateReadingId } = require('../validators/readings.validator');

// GET /api/readings?date=YYYY-MM-DD&slot=morning&page=1&limit=20
const list = async (req, res) => {
  res.json(await readingsService.list(req.user.id, validateListQuery(req.query)));
};

const create = async (req, res) => {
  const reading = await readingsService.create(req.user.id, validateReading(req.body));
  res.status(201).json({ reading });
};

const update = async (req, res) => {
  const id = validateReadingId(req.params.id);
  const reading = await readingsService.update(req.user.id, id, validateReading(req.body));
  res.json({ reading });
};

const remove = async (req, res) => {
  await readingsService.remove(req.user.id, validateReadingId(req.params.id));
  res.status(204).end();
};

module.exports = { list, create, update, remove };
