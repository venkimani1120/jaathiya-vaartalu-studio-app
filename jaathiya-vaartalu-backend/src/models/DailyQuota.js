const { Schema, model } = require('mongoose');
// One row per reporter per day. The unique index makes the daily limit race-safe.
const quotaSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  day: { type: String, required: true },  // YYYY-MM-DD in IST
  count: { type: Number, default: 0 }
});
quotaSchema.index({ user: 1, day: 1 }, { unique: true });
module.exports = model('DailyQuota', quotaSchema);
