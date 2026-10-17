const router = require('express').Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { STATE_OF } = require('../config/constants');
const { issue, verifyRefresh } = require('../utils/tokens');
const { authenticate } = require('../middleware/auth');
const { HttpError, wrap } = require('../utils/http');

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

// Anyone can sign up as a Reporter or an Editor (never Admin). The account stays inactive until an Admin approves it.
const SIGNUP_ROLES = ['reporter', 'editor'];
const ROLE_NAME = { reporter: 'Reporter', editor: 'Editor' };
router.post('/signup', limiter, wrap(async (req, res) => {
  const { name, email, phone, password, district, constituency } = req.body;
  const role = req.body.role || 'reporter';
  if (!SIGNUP_ROLES.includes(role)) throw new HttpError(400, 'You can sign up as a Reporter or an Editor.');
  if (role === 'reporter' && !district) throw new HttpError(400, 'Choose the district you report from.');
  const state = STATE_OF[district];
  if (!name || !email || !password) throw new HttpError(400, 'Name, email and password are required.');
  if (String(password).length < 8) throw new HttpError(400, 'Password must be at least 8 characters.');
  if (await User.exists({ email: String(email).toLowerCase() })) throw new HttpError(409, 'An account with this email already exists.');
  const user = await User.create({ name, email, phone, state, district, constituency,
    passwordHash: await bcrypt.hash(password, 12), role, active: false });
  res.status(201).json({ message: `Your ${ROLE_NAME[role]} account request has been sent. You can sign in once an Admin approves it.`, user: user.toPublic() });
}));

router.post('/login', limiter, wrap(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: String(email || '').toLowerCase() }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(String(password || ''), user.passwordHash))) throw new HttpError(401, 'Wrong email or password.');
  if (!user.active) throw new HttpError(403, user.approvedAt ? 'Your account has been turned off. Contact an Admin.' : 'Your account is waiting for Admin approval.');
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

// Signed-in users edit their own name, phone and profile photo (role and area stay admin-managed).
router.patch('/me', authenticate, wrap(async (req, res) => {
  const { name, phone, avatar } = req.body;
  const set = {};
  if (name !== undefined) {
    if (!String(name).trim()) throw new HttpError(400, 'Name cannot be empty.');
    set.name = String(name).trim();
  }
  if (phone !== undefined) set.phone = String(phone).trim();
  if (avatar !== undefined) {
    if (avatar && !/^(https?:\/\/|\/uploads\/)\S+$/.test(String(avatar))) throw new HttpError(400, 'Profile photo must be an uploaded image.');
    set.avatar = avatar || null;
  }
  const user = await User.findByIdAndUpdate(req.user.id, { $set: set }, { new: true, runValidators: true });
  if (!user) throw new HttpError(404, 'User not found.');
  res.json({ user: user.toPublic() });
}));

// Changing the password signs every other device out; this device gets fresh tokens.
router.post('/password', limiter, authenticate, wrap(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (String(newPassword || '').length < 8) throw new HttpError(400, 'New password must be at least 8 characters.');
  const user = await User.findById(req.user.id).select('+passwordHash');
  if (!user) throw new HttpError(404, 'User not found.');
  if (!(await bcrypt.compare(String(currentPassword || ''), user.passwordHash))) throw new HttpError(400, 'Current password is wrong.');
  if (await bcrypt.compare(String(newPassword), user.passwordHash)) throw new HttpError(400, 'New password must be different from the current one.');
  user.passwordHash = await bcrypt.hash(String(newPassword), 12);
  user.tokenVersion += 1;
  await user.save();
  res.json(issue(user));
}));

module.exports = router;
