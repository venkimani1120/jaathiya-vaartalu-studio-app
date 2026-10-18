const router = require('express').Router();
const crypto = require('crypto');
const Epaper = require('../models/Epaper');
const News = require('../models/News');
const { authenticate, authorize } = require('../middleware/auth');
const { HttpError, wrap, pick } = require('../utils/http');
const { EDITION_TYPES } = require('../config/constants');

const FIELDS = ['title', 'type', 'key', 'editionDate', 'volume', 'issue', 'price', 'ad', 'tribute', 'pages'];
router.use(authenticate, authorize('editor', 'admin'));

// ?status=published&type=district&from=2026-10-01&to=2026-10-17 (dates are edition dates, both ends included)
const DAY = /^\d{4}-\d{2}-\d{2}$/;
router.get('/', wrap(async (req, res) => {
  const { status, type, from, to } = req.query;
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const filter = {};
  if (status) filter.status = status;
  if (type) {
    if (!EDITION_TYPES.includes(type)) throw new HttpError(400, 'Unknown edition type.');
    filter.type = type;
  }
  if ((from && !DAY.test(from)) || (to && !DAY.test(to))) throw new HttpError(400, 'Dates must look like 2026-10-17.');
  if (from || to) {
    filter.editionDate = {};
    if (from) filter.editionDate.$gte = new Date(`${from}T00:00:00Z`);
    if (to) filter.editionDate.$lt = new Date(new Date(`${to}T00:00:00Z`).getTime() + 864e5);
  }
  const [items, total] = await Promise.all([
    Epaper.find(filter).sort({ editionDate: -1, createdAt: -1 }).limit(limit).select('-tribute'),
    Epaper.countDocuments(filter)
  ]);
  res.json({ items, total });
}));

router.get('/:id', wrap(async (req, res) => {
  const epaper = await Epaper.findById(req.params.id);
  if (!epaper) throw new HttpError(404, 'Edition not found.');
  const news = await News.find({ _id: { $in: epaper.newsIds() } }).populate('author', 'name');
  res.json({ epaper, news });
}));

router.post('/', wrap(async (req, res) => {
  const epaper = await Epaper.create({ ...pick(req.body, FIELDS), createdBy: req.user.id, updatedBy: req.user.id });
  res.status(201).json({ epaper });
}));

// Saves the page layout (drag/drop, merges, page order). Any editor or admin can work on any edition.
router.put('/:id', wrap(async (req, res) => {
  const epaper = await Epaper.findById(req.params.id);
  if (!epaper) throw new HttpError(404, 'Edition not found.');
  Object.assign(epaper, pick(req.body, FIELDS), { updatedBy: req.user.id });
  await epaper.save();
  res.json({ epaper });
}));

router.post('/:id/publish', wrap(async (req, res) => {
  const epaper = await Epaper.findById(req.params.id);
  if (!epaper) throw new HttpError(404, 'Edition not found.');
  const ids = epaper.newsIds();
  if (!ids.length) throw new HttpError(400, 'Add news to the pages before publishing.');
  if (!epaper.shareSlug) {
    const d = epaper.editionDate.toISOString().slice(0, 10);
    epaper.shareSlug = `${d}-${crypto.randomBytes(4).toString('hex')}`;
  }
  epaper.status = 'published'; epaper.publishedAt = new Date(); epaper.updatedBy = req.user.id;
  await epaper.save();
  await News.updateMany({ _id: { $in: ids } }, { $set: { status: 'published' }, $addToSet: { publishedIn: epaper._id } });
  res.json({ epaper, shareUrl: `${process.env.PUBLIC_BASE_URL || ''}/e/${epaper.shareSlug}` });
}));

router.post('/:id/unpublish', authorize('admin'), wrap(async (req, res) => {
  const epaper = await Epaper.findByIdAndUpdate(req.params.id, { status: 'draft' }, { new: true });
  if (!epaper) throw new HttpError(404, 'Edition not found.');
  res.json({ epaper });
}));

// Editors and admins can delete any edition, draft or published. Its stories are kept; a story
// that is no longer in any published edition goes back to 'approved' so it can be placed again.
router.delete('/:id', wrap(async (req, res) => {
  const epaper = await Epaper.findByIdAndDelete(req.params.id);
  if (!epaper) throw new HttpError(404, 'Edition not found.');
  await News.updateMany({ publishedIn: epaper._id }, { $pull: { publishedIn: epaper._id } });
  await News.updateMany({ _id: { $in: epaper.newsIds() }, status: 'published', publishedIn: { $size: 0 } }, { $set: { status: 'approved' } });
  res.json({ ok: true });
}));

module.exports = router;
