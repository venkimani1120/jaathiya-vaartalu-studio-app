const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { authenticate } = require('../middleware/auth');
const { HttpError, wrap } = require('../utils/http');
const { MAX_IMAGES_PER_CARD } = require('../config/constants');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024, files: MAX_IMAGES_PER_CARD },
  fileFilter: (_req, f, cb) => cb(null, /^image\/(jpeg|png|webp|heic|heif)$/.test(f.mimetype))
});

let cloudinary = null;
if (process.env.CLOUDINARY_URL) cloudinary = require('cloudinary').v2; // reads CLOUDINARY_URL itself

function toCloudinary(buf) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { folder: 'jaathiya/news', resource_type: 'image', transformation: [{ width: 1600, crop: 'limit', quality: 'auto', fetch_format: 'auto' }] },
      (err, r) => (err ? reject(err) : resolve(r.secure_url))
    ).end(buf);
  });
}
// Fallback for local development only: free hosts wipe local disk on restart.
const LOCAL_DIR = path.join(__dirname, '../../uploads');
function toDisk(file) {
  fs.mkdirSync(LOCAL_DIR, { recursive: true });
  const name = crypto.randomBytes(8).toString('hex') + path.extname(file.originalname || '.jpg');
  fs.writeFileSync(path.join(LOCAL_DIR, name), file.buffer);
  return `${process.env.PUBLIC_BASE_URL || ''}/uploads/${name}`;
}

router.post('/', authenticate, upload.array('images', MAX_IMAGES_PER_CARD), wrap(async (req, res) => {
  if (!req.files || !req.files.length) throw new HttpError(400, 'Attach at least one image (JPG, PNG or WebP, up to 6 MB).');
  const urls = [];
  for (const f of req.files) urls.push(cloudinary ? await toCloudinary(f.buffer) : toDisk(f));
  res.status(201).json({ urls });
}));

module.exports = router;
