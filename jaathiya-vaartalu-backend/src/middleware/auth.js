const User = require('../models/User');
const { verifyAccess, sessionProblem } = require('../utils/tokens');
const { HttpError } = require('../utils/http');

// Checks the token and that its session is still the user's live one, then marks the session as
// active (at most once a minute, to spare the database). Role and name come from the user record,
// so a change applies at once.
async function authenticate(req, _res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Sign in to continue.'));
  let p;
  try { p = verifyAccess(token); } catch { return next(new HttpError(401, 'Session expired. Sign in again.')); }
  try {
    const user = await User.findById(p.sub).select('name role roles active sessionId sessionSeenAt');
    const problem = sessionProblem(user, p.sid);
    if (problem) {
      if (user && user.sessionId === p.sid) await User.updateOne({ _id: user._id, sessionId: p.sid }, { $unset: { sessionId: 1, sessionSeenAt: 1 } });
      return next(new HttpError(401, problem));
    }
    if (Date.now() - user.sessionSeenAt.getTime() > 60 * 1000)
      await User.updateOne({ _id: user._id, sessionId: p.sid }, { $set: { sessionSeenAt: new Date() } });
    req.user = { id: String(user._id), role: user.role, roles: user.roleList(), name: user.name, sid: p.sid };
    next();
  } catch (e) { next(e); }
}
// Lets the request through when the member holds any of the given roles.
const authorize = (...roles) => (req, _res, next) =>
  roles.some(r => req.user.roles.includes(r)) ? next() : next(new HttpError(403, 'Your role cannot do this.'));
module.exports = { authenticate, authorize };
