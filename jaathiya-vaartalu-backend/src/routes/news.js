const router = require('express').Router();
const News = require('../models/News');
const DailyQuota = require('../models/DailyQuota');
const { authenticate, authorize } = require('../middleware/auth');
const { DAILY_NEWS_LIMIT, NEWS_SOURCES, STATE_OF } = require('../config/constants');
const { HttpError, wrap, pick, today } = require('../utils/http');

const FIELDS = ['title', 'highlights', 'body', 'images', 'section', 'state', 'district', 'constituency', 'dateline'];
const REPORTER_EDITABLE = ['draft', 'submitted', 'rejected'];
const isDesk = u => u.role === 'admin' || u.role === 'editor';

router.use(authenticate);

// Atomically take one slot from today's quota. Fails with a duplicate-key error when the day is full.
async function takeQuota(userId) {
  try {
    const q = await DailyQuota.findOneAndUpdate(
      { user: userId, day: today(), count: { $lt: DAILY_NEWS_LIMIT } },
      { $inc: { count: 1 } }, { upsert: true, new: true });
    return q.count;
  } catch (e) {
    if (e.code === 11000) return null;
    throw e;
  }
}
const releaseQuota = userId => DailyQuota.updateOne({ user: userId, day: today(), count: { $gt: 0 } }, { $inc: { count: -1 } });

router.get('/quota/today', wrap(async (req, res) => {
  const q = await DailyQuota.findOne({ user: req.user.id, day: today() });
  const used = q ? q.count : 0;
  res.json({ used, limit: DAILY_NEWS_LIMIT, remaining: Math.max(0, DAILY_NEWS_LIMIT - used) });
}));

// Builds the list filter shared by the list and the per-source counts.
// Reporters see only their own cards. Editors/Admins see everything, filterable by constituency etc.
function listFilter(req, { withSource = true } = {}) {
  const { status, source, section, state, district, constituency, author, q, paper, page } = req.query;
  const filter = {};
  if (!isDesk(req.user) || author === 'me') filter.author = req.user.id;
  if (status) filter.status = { $in: String(status).split(',') };
  if (withSource && source) filter.source = { $in: String(source).split(',') };
  if (paper) { filter['sourceRef.paper'] = paper; if (page) filter['sourceRef.page'] = Number(page); }
  if (section) filter.section = section;
  if (state) filter.state = state;
  if (district) filter.district = district;
  if (constituency) filter.constituency = constituency;
  if (q) filter.title = { $regex: String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  // ?days=30&by=reviewedAt: only news whose upload (createdAt) or review (reviewedAt) date falls in
  // the last N days, newest first by that date.
  const by = req.query.by === 'reviewedAt' ? 'reviewedAt' : 'createdAt';
  const days = Math.min(Number(req.query.days) || 0, 365);
  if (days > 0) filter[by] = { $gte: new Date(Date.now() - days * 864e5) };
  return { filter, by };
}

router.get('/', wrap(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Math.min(Number(req.query.limit) || 30, 300);
  const { filter, by } = listFilter(req);
  const [items, total] = await Promise.all([
    News.find(filter).sort({ [by]: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('author', 'name'),
    News.countDocuments(filter)
  ]);
  res.json({ items, total, page });
}));

// How many cards match the other filters, per source: { counts: { reporter, editor, admin, epaper }, total }.
router.get('/counts', authorize('editor', 'admin'), wrap(async (req, res) => {
  const { filter } = listFilter(req, { withSource: false });
  const ns = await Promise.all(NEWS_SOURCES.map(source => News.countDocuments({ ...filter, source })));
  const counts = Object.fromEntries(NEWS_SOURCES.map((s, i) => [s, ns[i]]));
  res.json({ counts, total: ns.reduce((a, n) => a + n, 0) });
}));

router.get('/:id', wrap(async (req, res) => {
  const news = await News.findById(req.params.id).populate('author', 'name');
  if (!news) throw new HttpError(404, 'News not found.');
  if (!isDesk(req.user) && String(news.author._id) !== req.user.id) throw new HttpError(403, 'You can only open your own news.');
  res.json({ news });
}));

router.post('/', authorize('reporter', 'editor', 'admin'), wrap(async (req, res) => {
  const data = pick(req.body, FIELDS);
  if (data.district && STATE_OF[data.district]) data.state = STATE_OF[data.district];
  if (!data.title || !data.body) throw new HttpError(400, 'Headline and news text are required.');
  let used = null;
  if (req.user.role === 'reporter') {
    used = await takeQuota(req.user.id);
    if (used === null) throw new HttpError(429, `You have uploaded ${DAILY_NEWS_LIMIT} news cards today. The limit resets at midnight.`);
  }
  // Desk staff skip review: their submitted news goes straight to the approved pool.
  const status = req.body.submit ? (isDesk(req.user) ? 'approved' : 'submitted') : 'draft';
  try {
    const news = await News.create({ ...data, status, source: req.user.role, author: req.user.id });
    res.status(201).json({ news, quota: used === null ? null : { used, limit: DAILY_NEWS_LIMIT } });
  } catch (e) {
    if (used !== null) await releaseQuota(req.user.id);
    throw e;
  }
}));

router.patch('/:id', wrap(async (req, res) => {
  const news = await News.findById(req.params.id);
  if (!news) throw new HttpError(404, 'News not found.');
  if (!isDesk(req.user)) {
    if (String(news.author) !== req.user.id) throw new HttpError(403, 'You can only edit news you uploaded.');
    if (!REPORTER_EDITABLE.includes(news.status)) throw new HttpError(409, 'This news is already approved or published. Ask an editor to change it.');
  }
  Object.assign(news, pick(req.body, FIELDS));
  if (news.district && STATE_OF[news.district]) news.state = STATE_OF[news.district];
  if (req.body.submit) news.status = isDesk(req.user) ? 'approved' : 'submitted';
  else if (!isDesk(req.user) && news.status === 'rejected') news.status = 'draft';
  await news.save();
  res.json({ news });
}));

router.delete('/:id', wrap(async (req, res) => {
  const news = await News.findById(req.params.id);
  if (!news) throw new HttpError(404, 'News not found.');
  if (req.user.role !== 'admin') {
    if (String(news.author) !== req.user.id || !REPORTER_EDITABLE.includes(news.status)) throw new HttpError(403, 'You cannot delete this news.');
  }
  await news.deleteOne();
  res.json({ ok: true });
}));

router.post('/:id/review', authorize('editor', 'admin'), wrap(async (req, res) => {
  const { action, note } = req.body;
  if (!['approve', 'reject'].includes(action)) throw new HttpError(400, 'Action must be approve or reject.');
  const news = await News.findById(req.params.id);
  if (!news) throw new HttpError(404, 'News not found.');
  if (news.status === 'published') throw new HttpError(409, 'Already published.');
  news.status = action === 'approve' ? 'approved' : 'rejected';
  news.reviewNote = note || '';
  news.reviewedBy = req.user.id; news.reviewedAt = new Date();
  await news.save();
  res.json({ news });
}));

module.exports = router;
