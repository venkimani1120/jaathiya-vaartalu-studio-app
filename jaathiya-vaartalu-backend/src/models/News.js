const { Schema, model } = require('mongoose');
const { NEWS_STATUS, NEWS_SOURCES, SECTIONS, MAX_IMAGES_PER_CARD } = require('../config/constants');

// One "news card / tile": option 1 = multiple images, option 2 = related news text.
const newsSchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  highlights: { type: [{ type: String, trim: true, maxlength: 160 }], validate: v => v.length <= 5 },
  body: { type: String, required: true, maxlength: 20000 },
  images: { type: [String], validate: v => v.length <= MAX_IMAGES_PER_CARD },
  section: { type: String, enum: Object.keys(SECTIONS), default: 'constituency' },
  state: { type: String, default: 'ఆంధ్రప్రదేశ్' },
  district: { type: String, trim: true },
  constituency: { type: String, trim: true },
  dateline: { type: String, trim: true },
  status: { type: String, enum: NEWS_STATUS, default: 'draft', index: true },
  source: { type: String, enum: NEWS_SOURCES, default: 'reporter' },   // never taken from the request body
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
  reviewNote: String,
  publishedIn: [{ type: Schema.Types.ObjectId, ref: 'Epaper' }],
  // Imported news only: where on which e-paper page it was found. Boxes are in that page's pixels.
  sourceRef: {
    paper: { type: Schema.Types.ObjectId, ref: 'SourcePaper' },
    page: Number,
    publisher: String, editionName: String, editionDate: Date,
    bbox: { x: Number, y: Number, w: Number, h: Number },
    clipUrl: String,                                   // the whole article as printed
    photos: [{ _id: false, url: String, caption: String, bbox: { x: Number, y: Number, w: Number, h: Number } }],
    titleKey: String                                   // normalised headline, to skip repeats on the same date
  }
}, { timestamps: true });

newsSchema.index({ source: 1, status: 1, createdAt: -1 });
newsSchema.index({ 'sourceRef.paper': 1, 'sourceRef.page': 1 }, { sparse: true });
newsSchema.index({ 'sourceRef.editionDate': 1, 'sourceRef.titleKey': 1 }, { sparse: true });
newsSchema.index({ status: 1, state: 1, district: 1, constituency: 1, createdAt: -1 });
module.exports = model('News', newsSchema);
