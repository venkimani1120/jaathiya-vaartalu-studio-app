const router = require('express').Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { STATE_OF } = require('../config/constants');
const { issue, verifyRefresh } = require('../utils/tokens');
const { authenticate } = require('../middleware/auth');
const { HttpError, wrap } = require('../utils/http');

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

// Anyone can sign up; the account starts as an inactive Reporter until an Admin approves it.
router.post('/signup', limiter, wrap(async (req, res) => {
  const { name, email, phone, password, district, constituency } = req.body;
  const state = STATE_OF[district];
  if (!name || !email || !password) throw new HttpError(400, 'Name, email and password are required.');
  if (String(password).length < 8) throw new HttpError(400, 'Password must be at least 8 characters.');
  if (await User.exists({ email: String(email).toLowerCase() })) throw new HttpError(409, 'An account with this email already exists.');
  const user = await User.create({ name, email, phone, state, district, constituency,
    passwordHash: await bcrypt.hash(password, 12), role: 'reporter', active: false });
  res.status(201).json({ message: 'Account created. An admin must approve it before you can sign in.', user: user.toPublic() });
}));

router.post('/login', limiter, wrap(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: String(email || '').toLowerCase() }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(String(password || ''), user.passwordHash))) throw new HttpError(401, 'Wrong email or password.');
  if (!user.active) throw new HttpError(403, 'Your account is waiting for admin approval.');
  res.json(issue(user));
}));

router.post('/refresh', wrap(async (req, res) => {
  let p;
  try { p = verifyRefresh(req.body.refreshToken); } catch { throw new HttpError(401, 'Session expired. Sign in again.'); }
  const user = await User.findById(p.sub);
  if (!user || !user.active || user.tokenVersion !== p.tv) throw new HttpError(401, 'Session expired. Sign in again.');
  res.json(issue(user));
}));

router.post('/logout', authenticate, wrap(async (req, res) => {
  await User.updateOne({ _id: req.user.id }, { $inc: { tokenVersion: 1 } });
  res.json({ ok: true });
}));

router.get('/me', authenticate, wrap(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new HttpError(404, 'User not found.');
  res.json({ user: user.toPublic() });
}));

module.exports = router;
