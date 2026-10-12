const { Schema, model } = require('mongoose');
const { NEWS_STATUS, SECTIONS, MAX_IMAGES_PER_CARD } = require('../config/constants');

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
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
  reviewNote: String,
  publishedIn: [{ type: Schema.Types.ObjectId, ref: 'Epaper' }]
}, { timestamps: true });

newsSchema.index({ status: 1, state: 1, district: 1, constituency: 1, createdAt: -1 });
module.exports = model('News', newsSchema);
