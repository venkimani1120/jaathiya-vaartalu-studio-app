const { verifyAccess } = require('../utils/tokens');
const { HttpError } = require('../utils/http');

function authenticate(req, _res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Sign in to continue.'));
  try {
    const p = verifyAccess(token);
    req.user = { id: p.sub, role: p.role, name: p.name };
    next();
  } catch {
    next(new HttpError(401, 'Session expired. Sign in again.'));
  }
}
const authorize = (...roles) => (req, _res, next) =>
  roles.includes(req.user.role) ? next() : next(new HttpError(403, 'Your role cannot do this.'));
module.exports = { authenticate, authorize };
