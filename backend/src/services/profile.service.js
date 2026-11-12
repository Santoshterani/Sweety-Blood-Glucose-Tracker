const { isUniqueViolation } = require('../db');
const userRepository = require('../repositories/user.repository');
const { HttpError } = require('../utils/httpError');
const { toProfile } = require('../utils/profile');

async function getProfile(userId) {
  const user = await userRepository.findById(userId);
  if (!user) throw new HttpError(401, 'Your session has expired. Please log in again.');
  return toProfile(user);
}

async function updateProfile(userId, data) {
  let user;
  try {
    user = await userRepository.updateProfile(userId, data);
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
