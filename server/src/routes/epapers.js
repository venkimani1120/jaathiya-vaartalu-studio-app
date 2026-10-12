const router = require('express').Router();
const crypto = require('crypto');
const Epaper = require('../models/Epaper');
const News = require('../models/News');
const { authenticate, authorize } = require('../middleware/auth');
const { HttpError, wrap, pick } = require('../utils/http');

const FIELDS = ['title', 'type', 'key', 'editionDate', 'volume', 'issue', 'price', 'ad', 'tribute', 'pages'];
router.use(authenticate, authorize('editor', 'admin'));

router.get('/', wrap(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const items = await Epaper.find(req.query.status ? { status: req.query.status } : {})
    .sort({ editionDate: -1, createdAt: -1 }).limit(limit).select('-tribute');
  res.json({ items });
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

router.delete('/:id', authorize('admin'), wrap(async (req, res) => {
  await Epaper.deleteOne({ _id: req.params.id });
  res.json({ ok: true });
}));

module.exports = router;
