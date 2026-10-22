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

async function removePaper(paperId) {
  if (cloudinary) await cloudinary.api.delete_resources_by_prefix(folder(paperId) + '/');
  fs.rmSync(path.join(LOCAL_DIR, String(paperId)), { recursive: true, force: true });
}

module.exports = { DPI, canRenderPdf, savePage, removePaper };
