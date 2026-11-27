const router = require('express').Router();
const Epaper = require('../models/Epaper');
const News = require('../models/News');
const CalendarEvent = require('../models/CalendarEvent');
const { THEMES, themesOn } = require('../config/events');
const { STATES, SECTIONS, DAILY_NEWS_LIMIT } = require('../config/constants');
const { HttpError, wrap, today } = require('../utils/http');

router.get('/meta', (_req, res) => res.json({ states: STATES, sections: SECTIONS, dailyLimit: DAILY_NEWS_LIMIT }));

// Event themes for the e-paper header (config/events.js). No login: the public reader uses them too.
// /events?date=2026-08-15 -> { date, theme, events }: theme is the one to use (null for a plain header),
// events every listed event that day, calendar the names in Google's calendar that day.
router.get('/events', wrap(async (req, res) => {
  const date = req.query.date ? String(req.query.date) : today();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, 'The date must look like 2026-08-15.');
  const calendar = (await CalendarEvent.find({ day: date }).select('name').lean()).map(e => e.name);
  const events = themesOn(date, calendar);
  res.set('Cache-Control', 'public, max-age=3600').json({ date, theme: events[0] || null, events, calendar });
}));
// Every event theme, for choosing one by hand.
router.get('/themes', (_req, res) => res.set('Cache-Control', 'public, max-age=3600').json({ themes: THEMES }));

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
