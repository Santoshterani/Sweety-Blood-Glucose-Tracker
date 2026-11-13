const userRepository = require('../repositories/user.repository');

/** The registered doctors a patient can choose from. Names only: no emails or other details. */
async function listDoctors() {
  const rows = await userRepository.findDoctors();
  return rows.map((r) => ({ id: r.id, name: r.name }));
}

module.exports = { listDoctors };
