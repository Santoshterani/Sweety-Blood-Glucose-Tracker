const doctorsService = require('../services/doctors.service');

// GET /api/doctors  - the doctors a patient can choose from
const list = async (req, res) => {
  res.json({ doctors: await doctorsService.listDoctors() });
};

module.exports = { list };
