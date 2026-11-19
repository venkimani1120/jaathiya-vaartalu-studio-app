import { SECTIONS } from './constants';
import { MARK } from './ui';

// One approved news story drawn as an e-paper clipping: the masthead (header title and date) on top, then
// the section and place, headline, highlights, the first photo and the text. The browser draws the Telugu
// text, so the canvas is saved as a PNG as is, or placed on a one-page PDF of the same shape.

const TE_MONTHS = ['జనవరి', 'ఫిబ్రవరి', 'మార్చి', 'ఏప్రిల్', 'మే', 'జూన్', 'జూలై', 'ఆగస్టు', 'సెప్టెంబర్', 'అక్టోబర్', 'నవంబర్', 'డిసెంబర్'];
const TE_DAYS = ['ఆదివారం', 'సోమవారం', 'మంగళవారం', 'బుధవారం', 'గురువారం', 'శుక్రవారం', 'శనివారం'];
// 'YYYY-MM-DD' -> "బుధవారం, 19 నవంబర్ 2026" (same wording in the Admin app).
export function teluguDate(v) {
  const [y, m, d] = String(v).split('-').map(Number);
  const day = new Date(y, m - 1, d);
  return `${TE_DAYS[day.getDay()]}, ${d} ${TE_MONTHS[m - 1]} ${y}`;
}
export const DEFAULT_HEADER = 'జాతియ వార్తలు';

const W = 1080, PAD = 56, INNER = W - PAD * 2;
const COLOR = { red: '#E31E24', blue: '#1F3C99', navy: '#1B2A6B', ink: '#141414', muted: '#5A6275', line: '#D5DAE2' };
const FONT = {
  mast: '700 {px}px "Anek Telugu", "Noto Sans Telugu", sans-serif',
  head: '700 {px}px "Noto Sans Telugu", sans-serif',
  text: '400 {px}px "Noto Sans Telugu", sans-serif',
  bold: '700 {px}px "Noto Sans Telugu", sans-serif',
};
const font = (k, px) => FONT[k].replace('{px}', px);

function loadImage(src, cors) {
  return new Promise(resolve => {
    const img = new Image();
    if (cors) img.crossOrigin = 'anonymous';   // keeps the canvas saveable; Cloudinary and the API allow it
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Splits text into lines that fit maxW. Breaks at spaces; a word longer than a line is broken by letters.
function wrap(ctx, text, maxW) {
  const lines = [];
  for (const para of String(text || '').split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= maxW) { line = next; continue; }
      if (line) lines.push(line);
      line = word;
      while (ctx.measureText(line).width > maxW) {
        const chars = [...(Intl.Segmenter ? [...new Intl.Segmenter('te', { granularity: 'grapheme' }).segment(line)].map(s => s.segment) : line)];
        let cut = chars.length - 1;
        while (cut > 1 && ctx.measureText(chars.slice(0, cut).join('')).width > maxW) cut--;
        lines.push(chars.slice(0, cut).join(''));
        line = chars.slice(cut).join('');
      }
    }
    lines.push(line);
  }
  return lines;
}

// Lays the clipping out from top to bottom. With draw = false it only measures, to size the canvas.
function layout(ctx, n, { title, date }, photo, mark, draw) {
  let y = PAD;
  const text = (str, x, yy, k, px, color, align = 'left') => {
    if (!draw) return;
    ctx.font = font(k, px); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, yy);
  };
  const rect = (x, yy, w, h, color) => { if (draw) { ctx.fillStyle = color; ctx.fillRect(x, yy, w, h); } };

  // Masthead: logo mark and the header title, shrunk to fit one line.
  const markSize = mark ? 104 : 0, gap = mark ? 22 : 0;
  let px = 92;
  ctx.font = font('mast', px);
  while (px > 40 && ctx.measureText(title).width > INNER - markSize - gap) ctx.font = font('mast', --px);
  const tw = ctx.measureText(title).width;
  const left = PAD + (INNER - (markSize + gap + tw)) / 2;
  if (draw && mark) ctx.drawImage(mark, left, y, markSize, markSize);
  text(title, left + markSize + gap, y + Math.max(markSize, px) / 2 + px * 0.36, 'mast', px, COLOR.red);
  y += Math.max(markSize, px * 1.2) + 14;
  rect(PAD, y, INNER, 6, COLOR.red); y += 6;
  // Blue date bar, as on the e-paper's inner pages.
  rect(PAD, y + 8, INNER, 58, COLOR.blue);
  text(teluguDate(date), W / 2, y + 8 + 40, 'bold', 28, '#fff', 'center');
  y += 8 + 58 + 30;

  // Section and place.
  const where = [SECTIONS[n.section] || n.section, [n.constituency, n.district].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
  if (where) { text(where, PAD, y + 26, 'bold', 26, COLOR.red); y += 26 + 18; }

  // Headline.
  ctx.font = font('head', 54);
  for (const line of wrap(ctx, n.title, INNER)) { text(line, PAD, y + 54, 'head', 54, COLOR.ink); y += 54 * 1.42; }
  y += 10;

  // Highlights on a blue rule.
  const highlights = (n.highlights || []).filter(Boolean);
  if (highlights.length) {
    const top = y;
    ctx.font = font('bold', 30);
    for (const h of highlights) {
      const lines = wrap(ctx, h, INNER - 52);
      text('►', PAD + 22, y + 32, 'bold', 22, COLOR.blue);
      for (const line of lines) { text(line, PAD + 52, y + 32, 'bold', 30, COLOR.navy); y += 30 * 1.55; }
      y += 6;
    }
    rect(PAD, top, 6, y - top - 6, COLOR.blue);
    y += 18;
  }

  // First photo across the width, at most as tall as it is wide (taller ones are cropped to the middle).
  if (photo) {
    const h = Math.min(Math.round(INNER * photo.height / photo.width), INNER);
    if (draw) {
      const srcH = photo.width * h / INNER;
      ctx.drawImage(photo, 0, (photo.height - srcH) / 2, photo.width, srcH, PAD, y, INNER, h);
    }
    y += h + 30;
  }

  // The text, with the dateline in bold before it.
  const dateline = (n.dateline || n.constituency || n.district || '').trim();
  const body = dateline ? `${dateline}: ${n.body || ''}` : n.body || '';
  ctx.font = font('text', 32);
  wrap(ctx, body, INNER).forEach((line, i) => {
    const head = `${dateline}:`;
    if (i === 0 && dateline && draw && line.startsWith(head)) {
      text(head, PAD, y + 32, 'bold', 32, COLOR.ink);
      ctx.font = font('bold', 32);
      const hw = ctx.measureText(head).width;
      text(line.slice(head.length), PAD + hw, y + 32, 'text', 32, COLOR.ink);
    } else text(line, PAD, y + 32, 'text', 32, COLOR.ink);
    y += 32 * 1.7;
  });

  y += 16;
  rect(PAD, y, INNER, 3, COLOR.red);
  return y + 3 + PAD;
}

// Draws the clipping and returns { canvas, photoMissing }.
export async function renderClipping(news, opts) {
  await Promise.all(['700 92px "Anek Telugu"', '400 32px "Noto Sans Telugu"', '700 32px "Noto Sans Telugu"']
    .map(f => document.fonts?.load(f, 'తెలుగు').catch(() => {})));
  const [photo, mark] = await Promise.all([
    news.images?.[0] ? loadImage(news.images[0], true) : null,
    loadImage(MARK, false),
  ]);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = Math.ceil(layout(ctx, news, opts, photo, mark, false));
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  layout(ctx, news, opts, photo, mark, true);
  return { canvas, photoMissing: !!news.images?.[0] && !photo };
}

const toBlob = (canvas, type, q) => new Promise((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('Could not make the image.'))), type, q));

// A one-page PDF holding the clipping as a JPEG, page width A4 (595 pt) and as tall as the clipping.
async function toPdf(canvas) {
  const jpeg = new Uint8Array(await (await toBlob(canvas, 'image/jpeg', 0.92)).arrayBuffer());
  const pw = 595, ph = Math.round(pw * canvas.height / canvas.width * 100) / 100;
  const enc = new TextEncoder();
  const content = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
    [`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`, jpeg, '\nendstream'],
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  const parts = [enc.encode('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')];
  let size = parts[0].length;
  const offsets = [];
  const push = p => { const b = typeof p === 'string' ? enc.encode(p) : p; parts.push(b); size += b.length; };
  objs.forEach((o, i) => {
    offsets.push(size);
    push(`${i + 1} 0 obj\n`);
    [].concat(o).forEach(push);
    push('\nendobj\n');
  });
  const xref = size;
  push(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`);
  push(`trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}

// Renders the clipping and saves it as 'pdf' or 'png'. Returns { photoMissing }.
export async function downloadClipping(news, { title, date, format }) {
  const { canvas, photoMissing } = await renderClipping(news, { title, date });
  const blob = format === 'png' ? await toBlob(canvas, 'image/png') : await toPdf(canvas);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `jaathiya-vaartalu-${date}-${String(news._id).slice(-6)}.${format}`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  return { photoMissing };
}
