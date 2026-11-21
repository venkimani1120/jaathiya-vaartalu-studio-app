// Keeps a copy of Google's public Indian holidays calendar (festivals with their date for each year, about
// two years ahead) in the database, so the e-paper header can follow festivals whose date moves. Read
// once at start and then once a day; if Google can't be reached the last copy stays. No API key is needed.
// CALENDAR_ICS_URL picks another iCalendar feed; set it to 'off' to stop syncing.
const CalendarEvent = require('../models/CalendarEvent');

const GOOGLE_INDIA = 'https://calendar.google.com/calendar/ical/en.indian%23holiday%40group.v.calendar.google.com/public/basic.ics';
const DAY_MS = 864e5;

// iCalendar text -> [{ day: 'YYYY-MM-DD', name, kind }] (all-day events only).
function parseIcs(text) {
  const lines = String(text).replace(/\r?\n[ \t]/g, '').split(/\r?\n/);   // unfold continued lines
  const out = [];
  let ev = null;
  const unescape = v => v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') ev = {};
    else if (line === 'END:VEVENT') {
      if (ev && ev.day && ev.name) out.push({ day: ev.day, name: ev.name, kind: /observance/i.test(ev.desc || '') ? 'observance' : 'holiday' });
      ev = null;
    } else if (ev) {
      const i = line.indexOf(':'); if (i < 0) continue;
      const key = line.slice(0, i).split(';')[0], val = line.slice(i + 1);
      if (key === 'DTSTART') { const m = val.match(/^(\d{4})(\d{2})(\d{2})/); if (m) ev.day = `${m[1]}-${m[2]}-${m[3]}`; }
      else if (key === 'SUMMARY') ev.name = unescape(val).trim();
      else if (key === 'DESCRIPTION') ev.desc = unescape(val);
    }
  }
  return out;
}

async function sync(url = process.env.CALENDAR_ICS_URL || GOOGLE_INDIA) {
  const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`calendar feed answered ${r.status}`);
  const events = parseIcs(await r.text());
  if (!events.length) throw new Error('calendar feed has no events');
  const now = new Date();
  await CalendarEvent.bulkWrite(events.map(e => ({
    updateOne: { filter: { day: e.day, name: e.name }, update: { $set: { kind: e.kind, syncedAt: now } }, upsert: true }
  })), { ordered: false });
  await CalendarEvent.deleteMany({ syncedAt: { $lt: now } });   // moved or dropped by Google
  return events.length;
}

function start() {
  if (process.env.CALENDAR_ICS_URL === 'off') return;
  const run = () => sync().then(n => console.log(`Calendar synced: ${n} events`))
    .catch(e => console.error('Calendar sync failed:', e.message));
  run();
  setInterval(run, DAY_MS).unref();
}

module.exports = { parseIcs, sync, start };
