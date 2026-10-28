const sharp = require('sharp');

// The model's photo boxes are roughly right (usually exact left-right, often off top-bottom).
// This snaps each one to the photo's real edges using the page pixels: a photo is a solid block of
// tone, while text is thin lines with white gaps between them, so a photo shows up as a long run
// of rows (and columns) that are mostly non-white.
const INK = 246;          // grey level below which a pixel counts as non-white (light photo backgrounds too)
const FULL = 0.45;        // a row/column belongs to a photo when at least this share of it is non-white
const GAP = 4;            // white rows/columns allowed inside a photo
const MIN = 40;           // shortest photo side in pixels (text lines are shorter than this)

// Page image -> greyscale pixels. Transparent PNG areas count as white paper.
async function loadPixels(buf) {
  const { data, info } = await sharp(buf, { limitInputPixels: 60e6 }).flatten({ background: '#ffffff' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

// Share of non-white pixels along each row (dir 'y') or column (dir 'x') of a rectangle.
function profile(px, x0, x1, y0, y1, dir) {
  const out = new Float32Array(dir === 'y' ? y1 - y0 : x1 - x0);
  for (let y = y0; y < y1; y++) {
    const row = y * px.width;
    for (let x = x0; x < x1; x++) if (px.data[row + x] < INK) out[dir === 'y' ? y - y0 : x - x0]++;
  }
  const len = dir === 'y' ? x1 - x0 : y1 - y0;
  return out.map(v => v / len);
}

// Runs of "full" positions, bridging short gaps, at least MIN long. Offsets are added back.
function runs(p, offset) {
  const found = [];
  let a = -1, lastFull = -1;
  for (let i = 0; i <= p.length; i++) {
    const full = i < p.length && p[i] >= FULL;
    if (full) { if (a < 0) a = i; lastFull = i; }
    else if (a >= 0 && (i - lastFull > GAP || i === p.length)) {
      if (lastFull - a + 1 >= MIN) found.push([a + offset, lastFull + 1 + offset]);
      a = -1;
    }
  }
  return found;
}
const overlap = ([a, b], lo, hi) => Math.max(0, Math.min(b, hi) - Math.max(a, lo));
const best = (list, lo, hi) => list.reduce((m, r) => (overlap(r, lo, hi) > (m ? overlap(m, lo, hi) : 0) ? r : m), null);
const clamp = (v, lo, hi) => Math.min(Math.max(Math.round(v), lo), hi);

// box: { x, y, w, h } in page pixels. Returns the snapped box, or the original if no clear photo is found.
function snapPhoto(px, box) {
  const W = px.width, H = px.height;
  // Look well beyond the model's box, more top-bottom since that is where it is usually off.
  const wx0 = clamp(box.x - box.w * 0.3, 0, W), wx1 = clamp(box.x + box.w * 1.3, 0, W);
  const wy0 = clamp(box.y - box.h * 0.7, 0, H), wy1 = clamp(box.y + box.h * 1.7, 0, H);
  // 1. Rows, measured inside the middle of the model's columns (left-right is usually right).
  const cx0 = clamp(box.x + box.w * 0.15, 0, W), cx1 = clamp(box.x + box.w * 0.85, 0, W);
  let rows = best(runs(profile(px, cx0, cx1, wy0, wy1, 'y'), wy0), box.y, box.y + box.h);
  if (!rows) return box;
  // 2. Columns, measured across those rows.
  const cols = best(runs(profile(px, wx0, wx1, rows[0], rows[1], 'x'), wx0), box.x, box.x + box.w);
  if (!cols) return box;
  // 3. Rows again across the found columns, for exact top and bottom edges.
  const rows2 = best(runs(profile(px, cols[0], cols[1], wy0, wy1, 'y'), wy0), rows[0], rows[1]);
  if (rows2) rows = rows2;
  const snapped = { x: cols[0], y: rows[0], w: cols[1] - cols[0], h: rows[1] - rows[0] };
  // A result far from the model's size is more likely a wrong block (e.g. a shaded box): keep the model's.
  const ratio = (snapped.w * snapped.h) / (box.w * box.h);
  return ratio > 0.2 && ratio < 4 ? snapped : box;
}

module.exports = { loadPixels, snapPhoto };
