// Exact photo positions from a PDF page: every photo is an image placed on the page. Some layout
// tools slice each photo into thin strips (and lay text lines as image strips too), so touching
// strips of the same width or height are joined back first; what is left that is big enough is a photo.
const MIN_SIDE = 60;        // pixels; text-line strips are thinner than this
const TOUCH = 3;            // pixels between strips that still count as touching

let pdfjs;
const load = async () => (pdfjs ||= await import('pdfjs-dist/legacy/build/pdf.mjs'));

// Joins strips stacked vertically (same left edge and width) or side by side (same top and height).
function join(rects) {
  let list = rects.map(r => ({ ...r })), merged = true;
  while (merged) {
    merged = false;
    list.sort((a, b) => a.y - b.y || a.x - b.x);
    const out = [];
    for (const r of list) {
      const m = out.find(o =>
        (Math.abs(o.x - r.x) <= 2 && Math.abs(o.w - r.w) <= 2 && Math.abs(r.y - (o.y + o.h)) <= TOUCH) ||
        (Math.abs(o.y - r.y) <= 2 && Math.abs(o.h - r.h) <= 2 && Math.abs(r.x - (o.x + o.w)) <= TOUCH));
      if (m) {
        const x1 = Math.max(m.x + m.w, r.x + r.w), y1 = Math.max(m.y + m.h, r.y + r.h);
        m.x = Math.min(m.x, r.x); m.y = Math.min(m.y, r.y); m.w = x1 - m.x; m.h = y1 - m.y;
        merged = true;
      } else out.push(r);
    }
    list = out;
  }
  return list;
}

// pdf: a one-page PDF. Returns photo boxes in the pixels of that page rendered at `dpi`, or null when
// the page is a scan (one image covering most of it) or has no images.
async function photoRects(pdf, dpi) {
  const { getDocument, OPS, Util } = await load();
  const task = getDocument({ data: new Uint8Array(pdf), isEvalSupported: false, verbosity: 0 });
  const doc = await task.promise;
  try {
    const page = await doc.getPage(1);
    const view = page.getViewport({ scale: dpi / 72 });
    const ops = await page.getOperatorList();
    const rects = [], stack = [];
    let ctm = [1, 0, 0, 1, 0, 0];
    ops.fnArray.forEach((fn, i) => {
      const a = ops.argsArray[i];
      if (fn === OPS.save) stack.push(ctm);
      else if (fn === OPS.restore) ctm = stack.pop() || ctm;
      else if (fn === OPS.transform) ctm = Util.transform(ctm, a);
      else if (fn === OPS.paintFormXObjectBegin) { stack.push(ctm); if (a?.[0]) ctm = Util.transform(ctm, a[0]); }
      else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() || ctm;
      else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject || fn === OPS.paintImageXObjectRepeat) {
        // The image fills the unit square of the current matrix; map its corners to page pixels.
        const m = Util.transform(view.transform, ctm);
        const xs = [m[4], m[0] + m[4], m[2] + m[4], m[0] + m[2] + m[4]], ys = [m[5], m[1] + m[5], m[3] + m[5], m[1] + m[3] + m[5]];
        const x = Math.max(0, Math.min(...xs)), y = Math.max(0, Math.min(...ys));
        rects.push({ x, y, w: Math.min(view.width, Math.max(...xs)) - x, h: Math.min(view.height, Math.max(...ys)) - y });
      }
    });
    if (!rects.length) return null;
    const photos = join(rects).filter(r => r.w >= MIN_SIDE && r.h >= MIN_SIDE)
      .map(r => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) }));
    if (photos.some(r => r.w * r.h > 0.5 * view.width * view.height)) return null;   // a scanned page
    return photos;
  } finally { await task.destroy(); }
}

module.exports = { photoRects };
