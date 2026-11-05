const { Schema, model } = require('mongoose');
const { EDITION_TYPES } = require('../config/constants');

const pageSchema = new Schema({
  id: { type: String, required: true },
  template: { type: String, required: true },
  label: String,
  slots: { type: Map, of: String, default: {} },   // slotId -> News id
  styles: { type: Map, of: String, default: {} },  // slotId -> headline style (red / blue / boxed)
  // News id -> how that story shows on this page only (the news card is not changed):
  // { kind: 'story'|'brief', images: [urls], title, body, deck: false }
  // Box sizes set by hand in the studio: { ids, rows: [[slot ids per column]], w: [row heights], kinds }.
  // Used while the same stories are on the page; otherwise the page is laid out automatically.
  layout: Schema.Types.Mixed,
  content: { type: Map, of: Schema.Types.Mixed, default: {},
    validate: { validator: v => !v || JSON.stringify(Object.fromEntries(v)).length <= 300000, message: 'Too much story text on one page.' } }
}, { _id: false });

const epaperSchema = new Schema({
  title: { type: String, required: true },
  type: { type: String, enum: EDITION_TYPES, default: 'state' },
  key: String,                                     // district or constituency name
  editionDate: { type: Date, required: true },
  volume: String, issue: String, price: String,
  ad: { title: String, text: String, phone: String },
  tribute: { type: String, maxlength: 400000 },    // small masthead photo (data URL)
  pages: [pageSchema],
  status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
  shareSlug: { type: String, unique: true, sparse: true },
  publishedAt: Date,
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

epaperSchema.methods.newsIds = function () {
  const ids = new Set();
  this.pages.forEach(p => p.slots.forEach(v => v && ids.add(String(v))));
  return [...ids];
};
module.exports = model('Epaper', epaperSchema);
