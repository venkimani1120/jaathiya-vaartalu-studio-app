const { PDFDocument } = require('pdf-lib');
const SourcePaper = require('../models/SourcePaper');
const { savePage, DPI } = require('./pageStore');
const { photoRects } = require('./pdfPhotos');
const extractor = require('./extractor');

// Opens an uploaded PDF and returns its page count plus a function that makes a one-page PDF,
// so pages are split one at a time instead of all at once in memory.
async function openPdf(buf) {
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const count = doc.getPageCount();
  const pageAt = async i => {
    const one = await PDFDocument.create();
    const [p] = await one.copyPages(doc, [i]);
    one.addPage(p);
    return Buffer.from(await one.save());
  };
  return { count, pageAt };
}

const setPage = (id, no, fields) => SourcePaper.updateOne({ _id: id, 'pages.no': no },
  { $set: Object.fromEntries(Object.entries(fields).map(([k, v]) => [`pages.$.${k}`, v])) });

async function finish(id) {
  const paper = await SourcePaper.findById(id, 'pages');
  if (!paper) return;
  const failed = paper.pages.filter(p => p.status !== 'ready').length;
  await SourcePaper.updateOne({ _id: id }, failed === paper.pages.length
    ? { status: 'failed', error: 'No page could be stored.' }
    : { status: 'ready', ...(failed ? { error: `${failed} page(s) could not be stored.` } : {}) });
}

// Stores every page in the background after the upload has been answered. `source` is either
// { pdf: openPdf(...) result } or { images: [{ buffer, ext }] }. The upload is held in memory only,
// so a restart part-way leaves the rest of the pages failed (see recoverInterrupted).
async function processPaper(id, source) {
  const count = source.pdf ? source.pdf.count : source.images.length;
  for (let i = 0; i < count; i++) {
    const no = i + 1;
    try {
      let page;
      if (source.pdf) {
        const one = await source.pdf.pageAt(i);
        page = await savePage(id, no, one, 'pdf');
        try { const rects = await photoRects(one, DPI); page = { ...page, pdfPhotos: rects || [], pdfChecked: true }; }
        catch (e) { console.error(`Import ${id} page ${no} photo boxes:`, e.message); }
      } else page = await savePage(id, no, source.images[i].buffer, 'image', source.images[i].ext);
      await setPage(id, no, { ...page, status: 'ready' });
      extractor.wake();
    } catch (e) {
      console.error(`Import ${id} page ${no}:`, e.message);
      await setPage(id, no, { status: 'failed', error: String(e.message || e).slice(0, 300) });
    }
  }
  await finish(id);
}

// Uploads cut off by a restart: mark their unfinished pages failed so the desk can upload again.
async function recoverInterrupted() {
  const stuck = await SourcePaper.find({ status: 'processing' }, '_id');
  for (const { _id } of stuck) {
    await SourcePaper.updateOne({ _id }, { $set: { 'pages.$[p].status': 'failed', 'pages.$[p].error': 'The server restarted during the upload. Delete this e-paper and upload it again.' } },
      { arrayFilters: [{ 'p.status': 'pending' }] });
    await finish(_id);
  }
}

module.exports = { openPdf, processPaper, recoverInterrupted };
