import React from 'react';
import { STATES, STATE_NAMES } from './constants';

// value = { state, district, constituency }. With allowAll, each level can be '' meaning "all".
// children (e.g. more filters) are added to the same grid row.
export default function PlacePicker({ value, onChange, allowAll = false, disabled = false, children }) {
  const { state = '', district = '', constituency = '' } = value;
  const districts = state ? Object.keys(STATES[state] || {}) : [];
  const cons = state && district ? STATES[state]?.[district] || [] : [];
  const set = patch => onChange({ ...value, ...patch });
  const blank = allowAll ? 'అన్నీ (All)' : 'Choose…';
  return (
    <div className="grid3">
      <label className="field"><span>State</span>
        <select value={state} disabled={disabled} onChange={e => set({ state: e.target.value, district: '', constituency: '' })}>
          <option value="" disabled={!allowAll}>{blank}</option>
          {STATE_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <label className="field"><span>District</span>
        <select value={district} disabled={disabled || !state} onChange={e => set({ district: e.target.value, constituency: '' })}>
          <option value="" disabled={!allowAll}>{blank}</option>
          {districts.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </label>
      <label className="field"><span>Constituency</span>
        <select value={constituency} disabled={disabled || !district} onChange={e => set({ constituency: e.target.value })}>
          <option value="">{allowAll ? blank : 'Whole district'}</option>
          {cons.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      {children}
    </div>
  );
}
