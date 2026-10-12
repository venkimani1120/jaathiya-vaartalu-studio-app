const router = require('express').Router();
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES, STATE_OF } = require('../config/constants');
const { HttpError, wrap } = require('../utils/http');

router.use(authenticate, authorize('admin'));

router.get('/', wrap(async (req, res) => {
  const q = {};
  if (req.query.pending === 'true') q.active = false;
  if (req.query.role) q.role = req.query.role;
  const users = await User.find(q).sort({ createdAt: -1 }).limit(500);
  res.json({ items: users.map(u => u.toPublic()) });
}));

// Approve / deactivate accounts and change roles. Any change signs the user out so the new role applies immediately.
router.patch('/:id', wrap(async (req, res) => {
  const { role, active, district, constituency } = req.body;
  if (req.params.id === req.user.id && (role && role !== 'admin' || active === false)) throw new HttpError(400, 'You cannot demote or deactivate yourself.');
  if (role && !ROLES.includes(role)) throw new HttpError(400, 'Unknown role.');
  const update = { $inc: { tokenVersion: 1 } };
  const set = {};
  if (role) set.role = role;
  if (typeof active === 'boolean') set.active = active;
  if (district !== undefined) { set.district = district; set.state = STATE_OF[district]; }
  if (constituency !== undefined) set.constituency = constituency;
  update.$set = set;
  const user = await User.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!user) throw new HttpError(404, 'User not found.');
  res.json({ user: user.toPublic() });
}));

module.exports = router;
