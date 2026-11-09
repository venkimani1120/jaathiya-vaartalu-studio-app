// Makes the launcher icons of the three mobile apps from the brand mark, one look per app so they can be
// told apart on a phone: the torch-and-map mark with a coloured badge for the app's job.
//   Reporter: saffron badge, microphone.   Admin: navy badge, shield with a tick.   Studio: red badge, layout grid (like the "Layout studio" button).
// Writes into each app's assets/:
//   icon.png           1024², opaque (iOS refuses icons with transparency; also Android's fallback)
//   adaptive-icon.png  1024², transparent, artwork inside Android's 66% safe circle (the launcher crops the rest)
//   monochrome-icon.png 1024², one-colour silhouette for Android 13+ themed icons
// Run from jaathiya-vaartalu-backend (it has sharp): node scripts/make-app-icons.js
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..', '..');
const SIZE = 1024;
const NAVY = '#1F3C99', SAFFRON = '#F28C28', RED = '#E31E24';

// Badge glyphs, drawn white on a 200×200 box centred on (0,0).
const GLYPHS = {
  mic: `<rect x="-34" y="-82" width="68" height="112" rx="34"/>
        <path d="M-62 -6 a62 62 0 0 0 124 0" fill="none" stroke="#fff" stroke-width="16" stroke-linecap="round"/>
        <rect x="-8" y="54" width="16" height="30" rx="4"/><rect x="-38" y="78" width="76" height="16" rx="8"/>`,
  shield: `<path d="M0 -88 L70 -60 V-6 C70 42 40 74 0 90 C-40 74 -70 42 -70 -6 V-60 Z"/>
           <path d="M-32 0 L-8 24 L36 -22" fill="none" stroke="__BG__" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>`,
  layout: `<rect x="-80" y="-80" width="72" height="72" rx="14"/><rect x="8" y="-80" width="72" height="72" rx="14"/>
           <rect x="-80" y="8" width="72" height="72" rx="14"/><rect x="8" y="8" width="72" height="72" rx="14"/>`,
};
const APPS = [
  ['reporter', SAFFRON, 'mic'],
  ['admin', NAVY, 'shield'],
  ['studio', RED, 'layout'],
];

// The badge: a coloured disc with a white ring and the glyph. mono = plain white silhouette, glyph cut out.
const badge = (color, glyph, r, mono) => {
  const s = r / 100;
  const inner = GLYPHS[glyph].replace(/__BG__/g, mono ? '__KEEP__' : color);   // mono mask: __KEEP__ becomes white = kept (the shield's tick)
  return mono
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="${2 * r}" height="${2 * r}">
        <defs><mask id="m"><rect width="100%" height="100%" fill="#fff"/>
          <g transform="translate(${r} ${r}) scale(${s * 0.78})" fill="#000">${inner.replace(/stroke="#fff"/g, 'stroke="#000"').replace(/__KEEP__/g, '#fff')}</g></mask></defs>
        <circle cx="${r}" cy="${r}" r="${r}" fill="#fff" mask="url(#m)"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="${2 * r}" height="${2 * r}">
        <circle cx="${r}" cy="${r}" r="${r}" fill="#fff"/>
        <circle cx="${r}" cy="${r}" r="${r * 0.9}" fill="${color}"/>
        <g transform="translate(${r} ${r}) scale(${s * 0.78})" fill="#fff">${inner}</g></svg>`;
};

// Mark + badge on a transparent square of `box` px; the badge sits on the mark's lower right.
async function artwork(mark, color, glyph, box, mono) {
  const markSize = Math.round(box * 0.9);
  let m = sharp(mark).resize(markSize, markSize, { fit: 'contain', background: '#0000' });
  if (mono) {   // silhouette: the mark sits on white paper, so its shape is wherever any colour channel is strong
    const flat = await sharp(await m.png().toBuffer()).flatten({ background: '#fff' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const { data, info: { channels: n } } = flat;
    const alpha = Buffer.alloc(markSize * markSize);
    for (let i = 0; i < alpha.length; i++) {
      const ink = 255 - Math.min(data[n * i], data[n * i + 1], data[n * i + 2]);   // 0 on white, high on any colour
      alpha[i] = Math.max(0, Math.min(255, (ink - 40) * 2));                        // drop faint edges and paper grain
    }
    m = sharp({ create: { width: markSize, height: markSize, channels: 3, background: '#fff' } })
      .joinChannel(alpha, { raw: { width: markSize, height: markSize, channels: 1 } });
  }
  const r = Math.round(box * 0.24);
  return sharp({ create: { width: box, height: box, channels: 4, background: '#0000' } })
    .composite([
      { input: await m.png().toBuffer(), left: 0, top: 0 },
      { input: Buffer.from(badge(color, glyph, r, mono)), left: box - 2 * r, top: box - 2 * r },
    ]).png().toBuffer();
}

(async () => {
  // The bare mark (no wordmark), cropped to its edges.
  const mark = await sharp(path.join(__dirname, 'brand/mark-1024.png'))
    .trim({ threshold: 10 }).png().toBuffer();
  for (const [app, color, glyph] of APPS) {
    const dir = path.join(ROOT, `jaathiya-vaartalu-${app}-mobile/assets`);
    const square = (input, at, bg) => sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: bg } })
      .composite([{ input, left: at, top: at }]);
    // iOS / fallback: artwork fills ~84% of a white square (iOS rounds the corners itself).
    const full = Math.round(SIZE * 0.84);
    await square(await artwork(mark, color, glyph, full), Math.round((SIZE - full) / 2), '#ffffff')
      .flatten({ background: '#ffffff' }).removeAlpha().png().toFile(path.join(dir, 'icon.png'));
    // Android adaptive: inside the safe circle (diameter 66%), so a ~58% square (its corners are mostly empty).
    const safe = Math.round(SIZE * 0.58), at = Math.round((SIZE - safe) / 2);
    await square(await artwork(mark, color, glyph, safe), at, '#0000').png().toFile(path.join(dir, 'adaptive-icon.png'));
    await square(await artwork(mark, color, glyph, safe, true), at, '#0000').png().toFile(path.join(dir, 'monochrome-icon.png'));
    console.log(`${app}: icon.png, adaptive-icon.png, monochrome-icon.png`);
  }
})().catch(e => { console.error(e); process.exit(1); });
