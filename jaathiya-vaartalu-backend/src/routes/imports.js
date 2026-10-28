const router = require('express').Router();
const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
const { imageSize } = require('image-size');
const SourcePaper = require('../models/SourcePaper');
const { authenticate, authorize } = require('../middleware/auth');
const { HttpError, wrap } = require('../utils/http');
const { DISTRICTS, EDITION_TYPES } = require('../config/constants');
const { DPI, canRenderPdf, removePaper } = require('../services/pageStore');
const { openPdf, processPaper } = require('../services/importer');
const extractor = require('../services/extractor');
const News = require('../models/News');

// Other papers' e-papers, uploaded by the desk so their news can be extracted and reused.
router.use(authenticate, authorize('editor', 'admin'));

const MAX_MB = Number(process.env.IMPORT_MAX_MB || 60);
const MAX_PAGES = 40;
const IMAGE_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: MAX_PAGES },
  fileFilter: (_req, f, cb) => cb(null, f.fieldname === 'file' ? f.mimetype === 'application/pdf' : !!IMAGE_EXT[f.mimetype])
}).fields([{ name: 'file', maxCount: 1 }, { name: 'pages', maxCount: MAX_PAGES }]);
// Multer's own errors (too many files, too big) as plain messages.
const receive = (req, res, next) => upload(req, res, e => {
  if (!e) return next();
  if (e.code === 'LIMIT_FILE_SIZE') return next(new HttpError(413, `Each file must be under ${MAX_MB} MB.`));
  if (e.code === 'LIMIT_FILE_COUNT' || e.code === 'LIMIT_UNEXPECTED_FILE') return next(new HttpError(400, `Upload one PDF, or up to ${MAX_PAGES} page images.`));
  next(e);
});

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const dayStart = d => new Date(`${d}T00:00:00Z`);
const text = (v, max) => String(v || '').trim().slice(0, max);

// GET /api/imports?from=2026-10-20&to=2026-10-22&publisher=Eenadu  (edition dates, both ends included)
router.get('/', wrap(async (req, res) => {
  const { from, to, publisher } = req.query;
  if ((from && !DAY.test(from)) || (to && !DAY.test(to))) throw new HttpError(400, 'Dates must look like 2026-10-17.');
  const filter = {};
  if (publisher) filter.publisher = publisher;
  if (from || to) {
    filter.editionDate = {};
    if (from) filter.editionDate.$gte = dayStart(from);
    if (to) filter.editionDate.$lt = new Date(dayStart(to).getTime() + 864e5);
  }
  const limit = Math.min(Number(req.query.limit) || 100, 200);
  const [items, total] = await Promise.all([
    SourcePaper.find(filter).sort({ editionDate: -1, publisher: 1, editionName: 1 }).limit(limit).populate('uploadedBy', 'name'),
    SourcePaper.countDocuments(filter)
  ]);
  res.json({ items, total });
}));

// Whether news extraction is switched on (GEMINI_API_KEY), for the UI.
router.get('/status', (_req, res) => res.json({ extraction: extractor.status() }));

// Names already used, for the upload form's suggestions.
router.get('/publishers', wrap(async (_req, res) => {
  const [publishers, editions] = await Promise.all([SourcePaper.distinct('publisher'), SourcePaper.distinct('editionName')]);
  res.json({ publishers: publishers.sort(), editions: editions.sort() });
}));

router.get('/:id', wrap(async (req, res) => {
  const paper = await SourcePaper.findById(req.params.id).populate('uploadedBy', 'name');
  if (!paper) throw new HttpError(404, 'Imported e-paper not found.');
  res.json({ paper });
}));

// multipart: "file" (one PDF) or "pages" (page images in order), plus
// publisher, editionName, editionDate (YYYY-MM-DD), editionType, district.
// Answers 202 straight away; pages are stored in the background (poll GET /:id).
router.post('/', receive, wrap(async (req, res) => {
  const pdf = req.files?.file?.[0];
  const images = req.files?.pages || [];
  if (pdf && images.length) throw new HttpError(400, 'Upload either one PDF or page images, not both.');
  if (!pdf && !images.length) throw new HttpError(400, 'Attach the e-paper as a PDF, or as JPG / PNG / WebP page images.');
  const publisher = text(req.body.publisher, 80), editionName = text(req.body.editionName, 80);
  if (!publisher || !editionName) throw new HttpError(400, 'Enter the paper name and the edition.');
  if (!DAY.test(req.body.editionDate || '')) throw new HttpError(400, 'Choose the date printed on the e-paper.');
  const editionType = req.body.editionType || 'district';
  if (!EDITION_TYPES.includes(editionType)) throw new HttpError(400, 'Unknown edition type.');
  const district = text(req.body.district, 80);
  if (district && !DISTRICTS[district]) throw new HttpError(400, 'Unknown district.');
  if (pdf && !canRenderPdf()) throw new HttpError(400, 'This server cannot read PDFs (CLOUDINARY_URL is not set). Upload page images instead.');

  const hash = crypto.createHash('sha256');
  (pdf ? [pdf] : images).forEach(f => hash.update(f.buffer));
  const fileHash = hash.digest('hex');
  const editionDate = dayStart(req.body.editionDate);
  const dup = await SourcePaper.findOne({ $or: [{ fileHash }, { publisher, editionName, editionDate }] }, 'publisher editionName editionDate');
  if (dup) throw new HttpError(409, `Already imported as ${dup.publisher} – ${dup.editionName}, ${dup.editionDate.toISOString().slice(0, 10)}. Delete that one first to upload again.`);

  let source, count;
  if (pdf) {
    try { source = { pdf: await openPdf(pdf.buffer) }; } catch { throw new HttpError(400, 'This PDF could not be opened. It may be damaged or password-protected.'); }
    count = source.pdf.count;
    if (count > MAX_PAGES) throw new HttpError(400, `This PDF has ${count} pages; the limit is ${MAX_PAGES}.`);
  } else {
    for (const f of images) {
      try { imageSize(f.buffer); } catch { throw new HttpError(400, `${f.originalname} is not a readable image.`); }
    }
    source = { images: images.map(f => ({ buffer: f.buffer, ext: IMAGE_EXT[f.mimetype] || path.extname(f.originalname) })) };
    count = images.length;
  }

  let paper;
  try {
    paper = await SourcePaper.create({
      publisher, editionName, editionType, district: district || undefined, editionDate,
      fileKind: pdf ? 'pdf' : 'images', fileName: text(pdf ? pdf.originalname : images[0].originalname, 200),
      fileBytes: (pdf ? [pdf] : images).reduce((a, f) => a + f.size, 0), fileHash, dpi: pdf ? DPI : undefined,
      pages: Array.from({ length: count }, (_, i) => ({ no: i + 1 })), uploadedBy: req.user.id
    });
  } catch (e) {
    if (e.code === 11000) throw new HttpError(409, 'This e-paper was imported a moment ago.');
    throw e;
  }
  processPaper(paper._id, source).catch(e => console.error(`Import ${paper._id} stopped:`, e));
  res.status(202).json({ paper });
}));

// Reads the paper again (all pages, or ?page=N). News from those pages that is not in the feed yet,
// waiting for review or sent back is replaced; approved and published news is kept.
router.post('/:id/extract', wrap(async (req, res) => {
  if (!extractor.status().enabled) throw new HttpError(400, 'News extraction is off. Set GEMINI_API_KEY on the server.');
  const paper = await SourcePaper.findById(req.params.id);
  if (!paper) throw new HttpError(404, 'Imported e-paper not found.');
  const no = req.query.page ? Number(req.query.page) : null;
  const pages = paper.pages.filter(p => p.status === 'ready' && (!no || p.no === no));
  if (!pages.length) throw new HttpError(400, 'No stored page to read.');
  if (pages.some(p => p.extract === 'running')) throw new HttpError(409, 'A page is being read right now. Try again in a minute.');
  const nos = pages.map(p => p.no);
  const removed = await News.deleteMany({ 'sourceRef.paper': paper._id, 'sourceRef.page': { $in: nos }, status: { $in: ['imported', 'draft', 'submitted', 'rejected'] } });
  pages.forEach(p => Object.assign(p, { extract: 'pending', extractTries: 0, nextTryAt: undefined, extractError: undefined, articles: undefined, repeats: undefined }));
  await paper.save();
  extractor.wake();
  res.json({ paper, removed: removed.deletedCount });
}));

// The desk picks which news read from this paper goes to the news feed:
// { ids: [...], action: 'add' } sends them for review; { ids, action: 'delete' } deletes them for good.
// Only news still waiting on this import (status 'imported') is touched.
router.post('/:id/news', wrap(async (req, res) => {
  const { action } = req.body;
  const ids = [...new Set((Array.isArray(req.body.ids) ? req.body.ids : []).map(String))];
  if (!['add', 'delete'].includes(action)) throw new HttpError(400, 'Unknown action.');
  if (!ids.length) throw new HttpError(400, 'Choose the news first.');
  if (ids.length > 300 || ids.some(id => !/^[a-f0-9]{24}$/.test(id))) throw new HttpError(400, 'Invalid news list.');
  if (!(await SourcePaper.exists({ _id: req.params.id }))) throw new HttpError(404, 'Imported e-paper not found.');
  const filter = { _id: { $in: ids }, 'sourceRef.paper': req.params.id, status: 'imported' };
  const done = action === 'add'
    ? (await News.updateMany(filter, { $set: { status: 'submitted' } })).modifiedCount
    : (await News.deleteMany(filter)).deletedCount;
  res.json({ [action === 'add' ? 'added' : 'deleted']: done });
}));

// Fits the photo crops of this paper's news to the photos' real edges again (no model call).
router.post('/:id/recrop', wrap(async (req, res) => {
  const paper = await SourcePaper.findById(req.params.id);
  if (!paper) throw new HttpError(404, 'Imported e-paper not found.');
  res.json({ updated: await extractor.recrop(paper) });
}));

// Deletes the import, its page images and its news that is not approved yet. Refused while any of
// its news is approved or published, since their photos are cut from these page images.
router.delete('/:id', wrap(async (req, res) => {
  const paper = await SourcePaper.findById(req.params.id);
  if (!paper) throw new HttpError(404, 'Imported e-paper not found.');
  if (paper.status === 'processing') throw new HttpError(409, 'Pages are still being stored. Delete it when that has finished.');
  if (paper.pages.some(p => p.extract === 'running')) throw new HttpError(409, 'A page is being read right now. Try again in a minute.');
  const used = await News.countDocuments({ 'sourceRef.paper': paper._id, status: { $in: ['approved', 'published'] } });
  if (used) throw new HttpError(409, `${used} news card(s) from this e-paper are approved or published and use its photos, so it can't be deleted.`);
  await News.deleteMany({ 'sourceRef.paper': paper._id });
  await removePaper(paper._id);
  await paper.deleteOne();
  res.json({ ok: true });
}));

module.exports = router;
