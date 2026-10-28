const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Every sign-in opens one session: a random id kept on the user and carried in both tokens (sid).
// A token only works while its sid is still the user's session, so a new sign-in elsewhere,
// sign-out, a password change or an admin change ends it at once. The session also ends after
// SESSION_IDLE_MINUTES without any request (default 15).
const ISSUER = 'jaathiya-vaartalu';
const ACCESS_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
const REFRESH_TTL = process.env.REFRESH_TOKEN_TTL || '30d';   // longest a session can last, however active
const IDLE_MS = Number(process.env.SESSION_IDLE_MINUTES || 15) * 60 * 1000;

const newSessionId = () => crypto.randomBytes(16).toString('hex');
const sign = (claims, secret, expiresIn, typ) =>
  jwt.sign({ ...claims, typ }, secret, { expiresIn, issuer: ISSUER, jwtid: crypto.randomUUID() });
const access = u => sign({ sub: String(u._id), sid: u.sessionId, role: u.role, name: u.name },
  process.env.JWT_ACCESS_SECRET, ACCESS_TTL, 'access');
const refresh = u => sign({ sub: String(u._id), sid: u.sessionId }, process.env.JWT_REFRESH_SECRET, REFRESH_TTL, 'refresh');

const verify = (t, secret, typ, opts = {}) => {
  const p = jwt.verify(String(t || ''), secret, { ...opts, issuer: ISSUER });
  if (p.typ !== typ || !p.sid) throw new Error('Wrong token type');
  return p;
};

// Why a token's session no longer works, or null if it does. user needs sessionId and sessionSeenAt.
function sessionProblem(user, sid) {
  if (!user || !user.active) return 'Session expired. Sign in again.';
  if (!user.sessionId) return 'You were signed out. Sign in again.';
  if (user.sessionId !== sid) return 'Your account was signed in on another device. Sign in again.';
  if (!user.sessionSeenAt || Date.now() - user.sessionSeenAt.getTime() > IDLE_MS) return `Signed out after ${IDLE_MS / 60000} minutes without activity. Sign in again.`;
  return null;
}

const issue = u => ({ accessToken: access(u), refreshToken: refresh(u), user: u.toPublic() });
module.exports = {
  issue, newSessionId, sessionProblem,
  verifyAccess: (t, opts) => verify(t, process.env.JWT_ACCESS_SECRET, 'access', opts),
  verifyRefresh: (t, opts) => verify(t, process.env.JWT_REFRESH_SECRET, 'refresh', opts)
};
