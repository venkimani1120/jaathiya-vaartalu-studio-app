const SourcePaper = require('../models/SourcePaper');
const News = require('../models/News');
const { DISTRICTS, STATE_OF, SECTIONS } = require('../config/constants');
const { cropUrl, modelImage, pageBuffer, pagePdf, DPI } = require('./pageStore');
const { photoRects } = require('./pdfPhotos');
const { loadPixels, snapPhoto } = require('./snap');
const gemini = require('./gemini');

// Works through stored e-paper pages one at a time: reads each with the model and saves every
// article as an 'epaper' news card waiting for review. Progress is kept on the page, so it carries
// on after a restart. Calls are spaced out to stay inside the free tier's per-minute limit.
const GAP_MS = Number(process.env.EXTRACT_GAP_SECONDS || 8) * 1000;
const MAX_TRIES = 3;
let timer = null, busy = false, idle = false, pausedUntil = 0;

const setPage = (id, no, fields) => SourcePaper.updateOne({ _id: id, 'pages.no': no },
  { $set: Object.fromEntries(Object.entries(fields).map(([k, v]) => [`pages.$.${k}`, v])) });

const titleKey = t => t.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
const clean = (s, max) => String(s || '').replace(/[ \t]+/g, ' ').trim().slice(0, max);

// [ymin, xmin, ymax, xmax] on a 0-1000 scale -> pixel box on the stored page, or null if unusable.
function toBox(b, page) {
  if (!Array.isArray(b) || b.length !== 4 || b.some(v => typeof v !== 'number')) return null;
  const [y0, x0, y1, x1] = b.map(v => Math.min(Math.max(v, 0), 1000) / 1000);
  const box = { x: Math.round(x0 * page.width), y: Math.round(y0 * page.height), w: Math.round((x1 - x0) * page.width), h: Math.round((y1 - y0) * page.height) };
  return box.w >= 8 && box.h >= 8 ? box : null;
}

function place(a, paper) {
  let district = DISTRICTS[a.district] ? a.district : paper.district || '';
  let constituency = '';
  if (a.constituency) {
    if (district && DISTRICTS[district]?.includes(a.constituency)) constituency = a.constituency;
    else if (!district) {
      const d = Object.keys(DISTRICTS).find(k => DISTRICTS[k].includes(a.constituency));
      if (d) { district = d; constituency = a.constituency; }
    }
  }
  return { district: district || undefined, constituency: constituency || undefined, ...(STATE_OF[district] ? { state: STATE_OF[district] } : {}) };
}

async function pixelsOf(page) {
  try { return await loadPixels(await pageBuffer(page.imageUrl)); }
  catch (e) { console.error(`Page pixels for ${page.imageUrl}:`, e.message); return null; }
}
// Exact photo boxes from the page's PDF, read once and kept on the page. null: not a PDF, a scan, or unreadable.
async function pdfPhotosOf(paper, page) {
  if (page.pdfChecked) return page.pdfPhotos?.length ? page.pdfPhotos.map(b => ({ x: b.x, y: b.y, w: b.w, h: b.h })) : null;
  if (paper.fileKind !== 'pdf') return null;
  try {
    const rects = await photoRects(await pagePdf(paper._id, page.no), paper.dpi || DPI);
    await setPage(paper._id, page.no, { pdfPhotos: rects || [], pdfChecked: true });
    return rects?.length ? rects : null;
  } catch (e) { console.error(`PDF photos for ${paper._id} p${page.no}:`, e.message); return null; }
}
// What the page offers for exact photo edges: the PDF's photo boxes, else the page pixels.
async function geometryOf(paper, page) {
  const pdfPhotos = await pdfPhotosOf(paper, page);
  return { pdfPhotos, px: pdfPhotos ? null : await pixelsOf(page) };
}

// Text likeness 0-1: share of 3-letter pieces two texts have in common (first 1000 letters).
// Catches the same story read twice, even with a letter or two read differently.
function shingles(t) {
  const s = titleKey(String(t || '')).slice(0, 1000), out = new Set();
  for (let i = 0; i + 3 <= s.length; i++) out.add(s.slice(i, i + 3));
  return out;
}
function likeness(a, b) {
  if (!a.size || !b.size) return 0;
  let common = 0;
  for (const x of a) if (b.has(x)) common++;
  return common / (a.size + b.size - common);
}
const SAME_STORY = 0.5;
const area = b => b.w * b.h;
const iou = (a, b) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? (w * h) / (area(a) + area(b) - w * h) : 0;
};
const union = (a, b) => {
  if (!a || !b) return a || b;
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};
const inter = (a, b) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};
const inside = (b, x, y) => b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

// Gives the stories on one page their real photos. items: [{ bbox, photos: [{ bbox, caption }] }] with
// the model's boxes. With PDF photo boxes, each PDF photo goes to the story whose model photo box it
// overlaps most, else to the smallest story box holding its centre; photos in no story (masthead,
// ads) are dropped, and model photo boxes with no PDF photo behind them too. Without them, each
// model photo box is snapped to the photo edges in the pixels. Story boxes are then widened to
// hold their photos.
function placePhotos(items, { pdfPhotos, px }) {
  if (pdfPhotos?.length) {
    const got = items.map(() => []);
    for (const r of pdfPhotos) {
      let best = null, score = 0.3;
      items.forEach((it, i) => it.photos.forEach(p => {
        const s = inter(r, p.bbox) / Math.min(area(r), area(p.bbox));
        if (s > score) { score = s; best = [i, p.caption]; }
      }));
      if (!best) {
        let smallest = Infinity;
        items.forEach((it, i) => { if (inside(it.bbox, r.x + r.w / 2, r.y + r.h / 2) && area(it.bbox) < smallest) { smallest = area(it.bbox); best = [i, '']; } });
      }
      if (best) got[best[0]].push({ bbox: { ...r }, caption: best[1] });
    }
    items.forEach((it, i) => { it.photos = got[i].sort((a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x); });
  } else if (px) {
    for (const it of items) it.photos = it.photos.map(p => ({ ...p, bbox: snapPhoto(px, p.bbox) }));
  }
  for (const it of items) for (const p of it.photos) it.bbox = it.bbox && union(it.bbox, p.bbox);
}

// One story listed twice on a page (the model sometimes splits a story at a sub-headline or a
// photo): keep one card, with the longer text and all the photos of both.
function mergeInto(keep, dup) {
  if (dup.body.length > keep.body.length) { keep.body = dup.body; keep.shingles = dup.shingles; }
  for (const h of dup.highlights) if (keep.highlights.length < 5 && !keep.highlights.includes(h)) keep.highlights.push(h);
  for (const p of dup.photos) if (!keep.photos.some(q => iou(p.bbox, q.bbox) > 0.5)) keep.photos.push(p);
  keep.bbox = union(keep.bbox, dup.bbox);
}

// Turns the model's articles into news documents. Repeats of a story already imported for the same
// date (district editions reprint state pages) are left out and counted.
async function toNews(articles, paper, page, geometry = {}) {
  const found = [];
  let repeats = 0;
  for (const a of articles || []) {
    const title = clean(a.headline, 200);
    if (!title) continue;
    const item = {
      a, title, key: titleKey(title), body: String(a.body || '').trim().slice(0, 20000) || title,
      highlights: (a.highlights || []).map(h => clean(h, 160)).filter(Boolean).slice(0, 5),
      bbox: toBox(a.box_2d, page),
      photos: (a.photos || []).map(p => ({ bbox: toBox(p.box_2d, page), caption: clean(p.caption, 300) })).filter(p => p.bbox)
    };
    item.shingles = shingles(item.body);
    const same = found.find(f => f.key === item.key || likeness(f.shingles, item.shingles) >= SAME_STORY);
    if (same) mergeInto(same, item); else found.push(item);
  }
  placePhotos(found, geometry);   // before the repeat check, so a repeat's photos are not handed to a neighbour
  const earlier = (await News.find({ 'sourceRef.editionDate': paper.editionDate }, 'body sourceRef.titleKey').lean())
    .map(n => ({ key: n.sourceRef?.titleKey, shingles: shingles(n.body) }));
  const docs = [];
  for (const f of found) {
    if (earlier.some(e => e.key === f.key || likeness(e.shingles, f.shingles) >= SAME_STORY)) { repeats++; continue; }
    const photos = f.photos.map(p => ({ ...p, url: cropUrl(page.imageUrl, p.bbox) || undefined }));
    docs.push({
      title: f.title, highlights: f.highlights, body: f.body,
      images: photos.map(p => p.url).filter(Boolean).slice(0, 10),
      section: SECTIONS[f.a.section] ? f.a.section : SECTIONS[paper.editionType] ? paper.editionType : 'district',
      ...place(f.a, paper),
      dateline: clean(f.a.dateline, 80) || undefined,
      status: 'submitted', source: 'epaper', author: paper.uploadedBy,
      sourceRef: {
        paper: paper._id, page: page.no, publisher: paper.publisher, editionName: paper.editionName, editionDate: paper.editionDate,
        bbox: f.bbox || undefined, clipUrl: (f.bbox && cropUrl(page.imageUrl, f.bbox)) || undefined, photos, titleKey: f.key
      }
    });
  }
  if (docs.length) await News.insertMany(docs);
  return { articles: docs.length, repeats: repeats + (articles || []).filter(a => clean(a.headline, 200)).length - found.length };
}

async function extractOne() {
  const now = new Date();
  const paper = await SourcePaper.findOne({
    pages: { $elemMatch: { status: 'ready', extract: { $in: ['pending', null] }, $or: [{ nextTryAt: null }, { nextTryAt: { $lte: now } }] } }
  }).sort({ createdAt: 1 });
  if (!paper) return false;
  const page = paper.pages.find(p => p.status === 'ready' && (!p.extract || p.extract === 'pending') && (!p.nextTryAt || p.nextTryAt <= now));
  await setPage(paper._id, page.no, { extract: 'running' });
  try {
    const consts = paper.district ? DISTRICTS[paper.district] || [] : [];
    const result = await gemini.extractPage(await modelImage(page.imageUrl),
      { publisher: paper.publisher, editionName: paper.editionName, districts: Object.keys(DISTRICTS), constituencies: consts });
    if (!(await SourcePaper.exists({ _id: paper._id }))) return true;   // deleted while being read
    const { articles, repeats } = await toNews(result.articles, paper, page, await geometryOf(paper, page));
    await setPage(paper._id, page.no, { extract: 'done', articles, repeats, extractError: '' });
    console.log(`Extracted ${paper.publisher} ${paper.editionName} p${page.no} with ${result.model}: ${articles} articles, ${repeats} repeats`);
  } catch (e) {
    if (e instanceof gemini.RateLimited) {
      pausedUntil = Date.now() + 60000;
      await setPage(paper._id, page.no, { extract: 'pending', nextTryAt: new Date(pausedUntil), extractError: 'Waiting: free-tier limit reached. Retrying shortly.' });
      return true;
    }
    if (e instanceof gemini.Busy) {
      await setPage(paper._id, page.no, { extract: 'pending', nextTryAt: new Date(Date.now() + 120000), extractError: 'Waiting: Gemini is busy. Retrying in 2 minutes.' });
      return true;
    }
    const tries = (page.extractTries || 0) + 1;
    console.error(`Extract ${paper._id} p${page.no} (try ${tries}):`, e.message);
    await setPage(paper._id, page.no, tries >= MAX_TRIES
      ? { extract: 'failed', extractTries: tries, extractError: String(e.message).slice(0, 300) }
      : { extract: 'pending', extractTries: tries, nextTryAt: new Date(Date.now() + tries * 120000), extractError: String(e.message).slice(0, 300) });
  }
  return true;
}

function schedule(ms) { clearTimeout(timer); timer = setTimeout(tick, ms); }
async function tick() {
  if (busy) return;
  if (Date.now() < pausedUntil) return schedule(pausedUntil - Date.now());
  busy = true;
  let worked = false;
  try { worked = await extractOne(); } catch (e) { console.error('Extractor:', e.message); }
  busy = false; idle = !worked;
  schedule(worked ? GAP_MS : 15000);
}

async function start() {
  if (!gemini.enabled()) { console.log('News extraction is off: set GEMINI_API_KEY to turn it on.'); return; }
  // A page being read when the server stopped is read again.
  await SourcePaper.updateMany({ 'pages.extract': 'running' }, { $set: { 'pages.$[p].extract': 'pending' } }, { arrayFilters: [{ 'p.extract': 'running' }] });
  // Pages that gave up only because Gemini was overloaded or a fallback model was retired get another go.
  await SourcePaper.updateMany({ 'pages.extract': 'failed' }, { $set: { 'pages.$[p].extract': 'pending', 'pages.$[p].extractTries': 0 } },
    { arrayFilters: [{ 'p.extract': 'failed', 'p.extractError': /^Gemini (50[034]|404)/ }] });
  console.log(`News extraction on (${gemini.MODEL}).`);
  schedule(2000);
}
// New pages to read: start now if the worker is waiting with nothing to do (never cuts the gap between calls).
const wake = () => { if (gemini.enabled() && idle && !busy && Date.now() >= pausedUntil) schedule(500); };
const status = () => ({ enabled: gemini.enabled(), model: gemini.enabled() ? gemini.MODEL : null, fallbacks: gemini.enabled() ? gemini.FALLBACKS : [] });

// Re-fits the photos of news already read from this paper, without asking the model again: the
// same photo placing as a fresh read, using the boxes stored on each card. Photos an editor added
// stay; published news is left as it is.
async function recrop(paper) {
  let changed = 0;
  const plain = b => (b && b.w ? { x: b.x, y: b.y, w: b.w, h: b.h } : null);
  for (const page of paper.pages.filter(p => p.status === 'ready')) {
    const news = await News.find({ 'sourceRef.paper': paper._id, 'sourceRef.page': page.no, status: { $ne: 'published' } });
    if (!news.length) continue;
    const geometry = await geometryOf(paper, page);
    if (!geometry.pdfPhotos && !geometry.px) continue;
    const items = news.map(n => ({ bbox: plain(n.sourceRef.bbox), photos: (n.sourceRef.photos || []).map(p => ({ bbox: plain(p.bbox), caption: p.caption })).filter(p => p.bbox) }));
    placePhotos(items, geometry);
    for (const [i, n] of news.entries()) {
      const oldAuto = (n.sourceRef.photos || []).map(p => p.url).filter(Boolean);
      const photos = items[i].photos.map(p => ({ ...p, url: cropUrl(page.imageUrl, p.bbox) || undefined }));
      n.images = [...photos.map(p => p.url).filter(Boolean), ...n.images.filter(u => !oldAuto.includes(u))].slice(0, 10);
      n.sourceRef.photos = photos;
      if (items[i].bbox) { n.sourceRef.bbox = items[i].bbox; n.sourceRef.clipUrl = cropUrl(page.imageUrl, items[i].bbox) || n.sourceRef.clipUrl; }
      await n.save();
      changed++;
    }
  }
  return changed;
}

module.exports = { start, wake, status, toBox, toNews, recrop, placePhotos };
