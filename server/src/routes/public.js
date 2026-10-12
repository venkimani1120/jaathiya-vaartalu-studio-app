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
    .select('title type key editionDate shareSlug');
  res.json({ items });
}));

module.exports = router;
