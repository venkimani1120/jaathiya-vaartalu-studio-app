const { Schema, model } = require('mongoose');
// One row per event in Google's Indian holidays calendar (services/calendar.js keeps it in step).
const calendarEventSchema = new Schema({
  day: { type: String, required: true },     // YYYY-MM-DD
  name: { type: String, required: true },    // as Google names it, e.g. "Diwali/Deepavali"
  kind: String,                              // 'holiday' or 'observance'
  syncedAt: Date
});
calendarEventSchema.index({ day: 1, name: 1 }, { unique: true });
module.exports = model('CalendarEvent', calendarEventSchema);
