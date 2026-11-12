// Controllers are thin: read the request, validate it, call a service, send the response.
const authService = require('../services/auth.service');
const { validateSignup, validateLogin } = require('../validators/auth.validator');

const signup = async (req, res) => {
  res.status(201).json(await authService.signup(validateSignup(req.body)));
};

const login = async (req, res) => {
  res.json(await authService.login(validateLogin(req.body)));
};

const me = async (req, res) => {
  res.json({ user: await authService.getCurrentUser(req.user.id) });
};

module.exports = { signup, login, me };
