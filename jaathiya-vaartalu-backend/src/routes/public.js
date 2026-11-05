const router = require('express').Router();
const Epaper = require('../models/Epaper');
const News = require('../models/News');
const { STATES, SECTIONS, DAILY_NEWS_LIMIT } = require('../config/constants');
const { HttpError, wrap } = require('../utils/http');

router.get('/meta', (_req, res) => res.json({ states: STATES, sections: SECTIONS, dailyLimit: DAILY_NEWS_LIMIT }));

// Anyone with the link can read a published edition. No login.
router.get('/epapers/:slug', wrap(async (req, res) => {
  const epaper = await Epaper.findOne({ shareSlug: req.params.slug, status: 'published' });
  if (!epaper) throw new HttpError(404, 'This edition is not published or the link is wrong.');
  const news = await News.find({ _id: { $in: epaper.newsIds() } })
    .select('title highlights body images section district constituency dateline author').populate('author', 'name');
  res.set('Cache-Control', 'public, max-age=120').json({ epaper, news });
}));

router.get('/epapers', wrap(async (_req, res) => {
  const items = await Epaper.find({ status: 'published' }).sort({ editionDate: -1 }).limit(30)
    .select('title type key editionDate shareSlug publishedAt');
  res.json({ items });
}));

// Approved news for the public website (it fetches this when it rebuilds). No login.
// ?days=30 (1-365): news approved in that many days; desk news is approved when created, so it has no reviewedAt.
// ?page=1: 200 per page, newest first; "more" says whether another page follows.
const PUBLIC_PAGE = 200;
router.get('/news', wrap(async (req, res) => {
  const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 30));
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const since = new Date(Date.now() - days * 864e5);
  const rows = await News.find({ status: { $in: ['approved', 'published'] },
    $or: [{ reviewedAt: { $gte: since } }, { reviewedAt: null, createdAt: { $gte: since } }] })
    .sort({ createdAt: -1, _id: -1 }).skip((page - 1) * PUBLIC_PAGE).limit(PUBLIC_PAGE + 1)
    .select('title highlights body images section state district constituency dateline author reviewedAt createdAt updatedAt')
    .populate('author', 'name');
  const items = rows.slice(0, PUBLIC_PAGE).map(n => ({
    id: String(n._id), title: n.title, highlights: n.highlights, body: n.body, images: n.images,
    section: n.section, state: n.state, district: n.district, constituency: n.constituency, dateline: n.dateline,
    author: n.author ? n.author.name : '', approvedAt: n.reviewedAt || n.createdAt, updatedAt: n.updatedAt
  }));
  res.set('Cache-Control', 'public, max-age=120').json({ items, more: rows.length > PUBLIC_PAGE });
}));

module.exports = router;
