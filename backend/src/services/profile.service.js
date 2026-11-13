const { isUniqueViolation } = require('../db');
const userRepository = require('../repositories/user.repository');
const { HttpError, validationError } = require('../utils/httpError');
const { ROLES } = require('../utils/roles');
const { toProfile } = require('../utils/profile');

async function getProfile(userId) {
  const user = await userRepository.findById(userId);
  if (!user) throw new HttpError(401, 'Your session has expired. Please log in again.');
  return toProfile(user);
}

async function updateProfile(userId, role, data) {
  // Only patients choose a doctor, and it must be a real doctor account.
  const doctorId = role === ROLES.PATIENT ? data.doctorId : null;
  if (doctorId !== null && !(await userRepository.findDoctorById(doctorId))) {
    throw validationError({ doctorId: 'Please choose a valid doctor.' });
  }

  let user;
  try {
    user = await userRepository.updateProfile(userId, { ...data, doctorId });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new HttpError(409, 'An account with this email already exists.', {
        email: 'An account with this email already exists.',
      });
    }
    throw err;
  }
  if (!user) throw new HttpError(401, 'Your session has expired. Please log in again.');
  return toProfile(user);
}

module.exports = { getProfile, updateProfile };
