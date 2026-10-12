class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const pick = (obj, keys) => Object.fromEntries(keys.filter(k => obj[k] !== undefined).map(k => [k, obj[k]]));
// Calendar day in IST, so the daily limit resets at midnight India time
function today() {
  const off = Number(process.env.TZ_OFFSET_MINUTES || 330);
  return new Date(Date.now() + off * 60000).toISOString().slice(0, 10);
}
module.exports = { HttpError, wrap, pick, today };
