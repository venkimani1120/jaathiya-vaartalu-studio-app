import React, { useRef } from 'react';
import { Icon } from './ui';

// Date filter and day grouping for news lists (the mobile apps' DateFilter.js offers the same choices).
// The value is a preset key ('', 'today', 'yesterday', '7', '30') or one picked day as 'YYYY-MM-DD'.
// The server reads from/to as whole days in IST.
export const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysAgo = n => iso(new Date(Date.now() - n * 864e5));
const DATES = { '': ['Any date'], today: ['Today', 0, 0], yesterday: ['Yesterday', 1, 1], 7: ['Last 7 days', 6, 0], 30: ['Last 30 days', 29, 0] };
const isDay = v => /^\d{4}-\d{2}-\d{2}$/.test(v);
const fromIso = v => { const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d); };
export const shortDate = d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

// The API params for a date value: { from, to }, or nothing for "Any date".
export function dateRange(value) {
  if (isDay(value)) return { from: value, to: value };
  const [, a, b] = DATES[value] || [];
  return a === undefined ? {} : { from: daysAgo(a), to: daysAgo(b) };
}

// Day headers: Today, Yesterday, then "Mon, 2 Nov 2026".
function dayLabel(d) {
  const k = iso(d);
  if (k === daysAgo(0)) return 'Today';
  if (k === daysAgo(1)) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
// [{ key, label, items }], one per day of n[by]. Lists arrive newest first, so each day's stories are together.
export function groupByDay(items, by = 'createdAt') {
  const out = [];
  (items || []).forEach(n => {
    const d = new Date(n[by] || n.createdAt), key = iso(d), last = out[out.length - 1];
    if (last && last.key === key) last.items.push(n); else out.push({ key, label: dayLabel(d), items: [n] });
  });
  return out;
}

// The chips: presets, then "Pick date", which opens the browser's calendar.
export function DateFilter({ value, onChange }) {
  const input = useRef(null);
  const picked = isDay(value) ? value : '';
  const pick = () => { const el = input.current; try { el.showPicker(); } catch { el.focus(); el.click(); } };
  return (
    <div className="chips" role="group" aria-label="Date">
      {Object.entries(DATES).map(([k, [label]]) => (
        <button type="button" key={k} aria-pressed={!picked && value === k} className={`chip ${!picked && value === k ? 'on' : ''}`}
          onClick={() => onChange(k)}>{label}</button>
      ))}
      <button type="button" aria-pressed={!!picked} className={`chip date-chip ${picked ? 'on' : ''}`} onClick={pick}>
        <Icon name="calendar" size={14} />
        {picked ? fromIso(picked).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Pick date'}
        <input ref={input} type="date" className="date-input" max={daysAgo(0)} value={picked} tabIndex={-1} aria-label="Pick a date"
          onChange={e => { if (e.target.value) onChange(e.target.value); }} />
      </button>
    </div>
  );
}

// A list of news cards under day headers.
export function DayGroups({ groups, children }) {
  return groups.map(g => (
    <section key={g.key} className="daygroup">
      <h3 className="dayhead">{g.label} <span className="count">{g.items.length}</span></h3>
      <div className="cards">{g.items.map(children)}</div>
    </section>
  ));
}
