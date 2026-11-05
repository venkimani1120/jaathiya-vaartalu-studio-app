const router = require('express').Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { STATE_OF } = require('../config/constants');
const { issue, verifyAccess, verifyRefresh, newSessionId, sessionProblem } = require('../utils/tokens');
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
  res.json(issue(await startSession(user)));
}));

// Opens a new session for the user, which ends any other one: one signed-in device at a time.
async function startSession(user) {
  user.sessionId = newSessionId();
  user.sessionSeenAt = new Date();
  await User.updateOne({ _id: user._id }, { $set: { sessionId: user.sessionId, sessionSeenAt: user.sessionSeenAt } });
  return user;
}

router.post('/refresh', wrap(async (req, res) => {
  let p;
  try { p = verifyRefresh(req.body.refreshToken); } catch { throw new HttpError(401, 'Session expired. Sign in again.'); }
  const user = await User.findById(p.sub).select('+sessionId +sessionSeenAt');
  const problem = sessionProblem(user, p.sid);
  if (problem) {
    if (user && user.sessionId === p.sid) await User.updateOne({ _id: user._id, sessionId: p.sid }, { $unset: { sessionId: 1, sessionSeenAt: 1 } });
    throw new HttpError(401, problem);
  }
  user.sessionSeenAt = new Date();
  await User.updateOne({ _id: user._id, sessionId: p.sid }, { $set: { sessionSeenAt: user.sessionSeenAt } });
  res.json(issue(user));
}));

// Ends the session on the server, so its tokens stop working at once. Takes the refresh token
// too, so a client whose access token has already expired can still sign out cleanly.
router.post('/logout', wrap(async (req, res) => {
  const h = req.headers.authorization || '';
  const tokens = [[h.startsWith('Bearer ') ? h.slice(7) : null, verifyAccess], [req.body?.refreshToken, verifyRefresh]];
  for (const [t, verify] of tokens) {
    if (!t) continue;
    try {
      const p = verify(t, { ignoreExpiration: true });
      await User.updateOne({ _id: p.sub, sessionId: p.sid }, { $unset: { sessionId: 1, sessionSeenAt: 1 } });
    } catch {}
  }
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

// Changing the password starts a new session: any other device is signed out, this one gets fresh tokens.
router.post('/password', limiter, authenticate, wrap(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (String(newPassword || '').length < 8) throw new HttpError(400, 'New password must be at least 8 characters.');
  const user = await User.findById(req.user.id).select('+passwordHash');
  if (!user) throw new HttpError(404, 'User not found.');
  if (!(await bcrypt.compare(String(currentPassword || ''), user.passwordHash))) throw new HttpError(400, 'Current password is wrong.');
  if (await bcrypt.compare(String(newPassword), user.passwordHash)) throw new HttpError(400, 'New password must be different from the current one.');
  user.passwordHash = await bcrypt.hash(String(newPassword), 12);
  await user.save();
  res.json(issue(await startSession(user)));
}));

module.exports = router;
