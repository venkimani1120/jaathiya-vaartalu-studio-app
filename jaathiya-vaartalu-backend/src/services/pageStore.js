const path = require('path');
const fs = require('fs');
const { imageSize } = require('image-size');

// Stores imported e-paper pages without resizing or recompressing them, so later crops keep the
// source pixels. Cloudinary when CLOUDINARY_URL is set (PDF pages are rendered to PNG there);
// otherwise local disk, which handles page images only and is for development.
let cloudinary = null;
if (process.env.CLOUDINARY_URL) cloudinary = require('cloudinary').v2;

const DPI = Math.min(Math.max(Number(process.env.IMPORT_DPI) || 200, 72), 300);
const canRenderPdf = () => !!cloudinary;
const folder = paperId => `jaathiya/sources/${paperId}`;
const LOCAL_DIR = path.join(__dirname, '../../uploads/sources');

function toCloudinary(buf, paperId, no) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { folder: folder(paperId), public_id: `p${no}`, resource_type: 'image', overwrite: true },
      (err, r) => (err ? reject(err) : resolve(r))
    ).end(buf);
  });
}

// Renders the page through Cloudinary and measures the PNG it serves, so width/height match the image exactly.
async function measure(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Page image could not be made (${r.status} ${r.headers.get('x-cld-error') || ''})`.trim());
  return imageSize(Buffer.from(await r.arrayBuffer()));
}

// kind: 'pdf' (a single-page PDF) or 'image'. Returns { imageUrl, width, height }.
async function savePage(paperId, no, buf, kind, ext = '.jpg') {
  if (cloudinary) {
    const up = await toCloudinary(buf, paperId, no);
    if (kind === 'image') return { imageUrl: up.secure_url, width: up.width, height: up.height };
    const imageUrl = cloudinary.url(up.public_id, { secure: true, format: 'png', density: DPI, version: up.version });
    const { width, height } = await measure(imageUrl);
    return { imageUrl, width, height };
  }
  if (kind === 'pdf') throw new Error('PDF pages need CLOUDINARY_URL on the server.');
  const { width, height } = imageSize(buf);
  const dir = path.join(LOCAL_DIR, String(paperId));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `p${no}${ext}`), buf);
  return { imageUrl: `${process.env.PUBLIC_BASE_URL || ''}/uploads/sources/${paperId}/p${no}${ext}`, width, height };
}

// Adds a Cloudinary transformation after the ones already in the URL (e.g. the PDF density),
// just before the version segment. Returns null for local files.
const isCloud = url => /\/image\/upload\//.test(url || '');
function transform(url, t) {
  if (!isCloud(url)) return null;
  return /\/v\d+\//.test(url) ? url.replace(/\/(v\d+\/)/, `/${t}/$1`) : url.replace('/image/upload/', `/image/upload/${t}/`);
}
// A box of the page at its original pixels, as lossless PNG. Local files: null (no image library here).
function cropUrl(imageUrl, { x, y, w, h }) {
  const u = transform(imageUrl, `c_crop,x_${Math.round(x)},y_${Math.round(y)},w_${Math.round(w)},h_${Math.round(h)}`);
  return u && u.replace(/\.(jpe?g|webp|png)$/i, '.png');
}

// The page as sent to the extraction model: a JPEG no wider than MODEL_WIDTH, to stay well under
// request limits. Boxes come back relative to the image, so they still map onto the original pixels.
const MODEL_WIDTH = Number(process.env.EXTRACT_IMAGE_WIDTH || 2400);
async function modelImage(imageUrl) {
  if (!imageUrl) throw new Error('This page has no stored image.');
  let buf, mime;
  if (isCloud(imageUrl)) {
    const r = await fetch(transform(imageUrl, `w_${MODEL_WIDTH},c_limit,q_88`).replace(/\.(png|webp|jpe?g)$/i, '.jpg'));
    if (!r.ok) throw new Error(`Could not load the page image (${r.status}).`);
    buf = Buffer.from(await r.arrayBuffer()); mime = 'image/jpeg';
  } else {
    const file = path.join(LOCAL_DIR, imageUrl.split('/uploads/sources/')[1] || '');
    buf = fs.readFileSync(file);
    mime = { '.png': 'image/png', '.webp': 'image/webp' }[path.extname(file).toLowerCase()] || 'image/jpeg';
  }
  if (buf.length > 14 * 1024 * 1024) throw new Error('The page image is too large to read (over 14 MB).');
  return { buffer: buf, mime };
}

// The stored one-page PDF. Cloudinary's free plan blocks plain PDF links, so this uses a signed API download.
async function pagePdf(paperId, no) {
  if (!cloudinary) throw new Error('PDF pages are only kept on Cloudinary.');
  const r = await fetch(cloudinary.utils.private_download_url(`${folder(paperId)}/p${no}`, 'pdf', { resource_type: 'image', type: 'upload' }));
  if (!r.ok) throw new Error(`Could not download the page PDF (${r.status}).`);
  return Buffer.from(await r.arrayBuffer());
}

// The stored page at full size, for measuring photo edges.
async function pageBuffer(imageUrl) {
  if (isCloud(imageUrl)) {
    const r = await fetch(imageUrl);
    if (!r.ok) throw new Error(`Could not load the page image (${r.status}).`);
    return Buffer.from(await r.arrayBuffer());
  }
  return fs.readFileSync(path.join(LOCAL_DIR, imageUrl.split('/uploads/sources/')[1] || ''));
}

async function removePaper(paperId) {
  if (cloudinary) await cloudinary.api.delete_resources_by_prefix(folder(paperId) + '/');
  fs.rmSync(path.join(LOCAL_DIR, String(paperId)), { recursive: true, force: true });
}

module.exports = { DPI, canRenderPdf, savePage, removePaper, cropUrl, modelImage, pageBuffer, pagePdf };
