const config = require('../config');
const profileService = require('../services/profile.service');
const { validateProfile } = require('../validators/profile.validator');
const { todayInTimezone } = require('../utils/dates');

const get = async (req, res) => {
  res.json({ profile: await profileService.getProfile(req.user.id) });
};

// Saves the whole form
const update = async (req, res) => {
  const data = validateProfile(req.body, todayInTimezone(config.timezone), req.user.role);
  res.json({ profile: await profileService.updateProfile(req.user.id, req.user.role, data) });
};

module.exports = { get, update };
