const jwt = require('jsonwebtoken');
const access = u => jwt.sign({ sub: String(u._id), role: u.role, name: u.name },
  process.env.JWT_ACCESS_SECRET, { expiresIn: process.env.ACCESS_TOKEN_TTL || '15m' });
const refresh = u => jwt.sign({ sub: String(u._id), tv: u.tokenVersion },
  process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.REFRESH_TOKEN_TTL || '30d' });
const issue = u => ({ accessToken: access(u), refreshToken: refresh(u), user: u.toPublic() });
module.exports = { issue, verifyAccess: t => jwt.verify(t, process.env.JWT_ACCESS_SECRET),
  verifyRefresh: t => jwt.verify(t, process.env.JWT_REFRESH_SECRET) };
