const { Schema, model } = require('mongoose');
const { EDITION_TYPES } = require('../config/constants');

// One page of an imported e-paper, stored at its original pixel size (PDF pages at IMPORT_DPI).
const pageSchema = new Schema({
  no: { type: Number, required: true },              // 1-based
  imageUrl: String,
  width: Number, height: Number,                     // pixels of imageUrl
  status: { type: String, enum: ['pending', 'ready', 'failed'], default: 'pending' },
  error: String
}, { _id: false });

// Another paper's e-paper, uploaded by the desk for news extraction.
const sourcePaperSchema = new Schema({
  publisher: { type: String, required: true, trim: true, maxlength: 80 },
  editionName: { type: String, required: true, trim: true, maxlength: 80 },   // e.g. "Guntur"
  editionType: { type: String, enum: EDITION_TYPES, default: 'district' },
  district: { type: String, trim: true },
  editionDate: { type: Date, required: true },        // UTC midnight of the paper's date
  fileKind: { type: String, enum: ['pdf', 'images'], required: true },
  fileName: String,
  fileBytes: Number,
  fileHash: { type: String, required: true },         // sha256 of the upload, to stop the same file twice
  dpi: Number,                                        // PDF only
  pages: [pageSchema],
  status: { type: String, enum: ['processing', 'ready', 'failed'], default: 'processing', index: true },
  error: String,
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

sourcePaperSchema.index({ fileHash: 1 }, { unique: true });
sourcePaperSchema.index({ publisher: 1, editionName: 1, editionDate: 1 }, { unique: true });
sourcePaperSchema.index({ editionDate: -1, createdAt: -1 });
module.exports = model('SourcePaper', sourcePaperSchema);
