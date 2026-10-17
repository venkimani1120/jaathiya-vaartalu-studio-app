import React from 'react';
import { View } from 'react-native';
import { STATES, STATE_NAMES } from './constants';
import { Chips } from './ui';

// value = { state, district, constituency }. With allowAll, each level can be '' meaning "all".
export default function PlacePicker({ value, onChange, allowAll = false, disabled = false, labels = true }) {
  const { state = '', district = '', constituency = '' } = value;
  const all = allowAll ? [['', 'అన్నీ']] : [];
  const districts = state ? Object.keys(STATES[state]) : [];
  const cons = state && district ? STATES[state][district] || [] : [];
  const set = patch => { if (!disabled) onChange({ ...value, ...patch }); };
  return (
    <View>
      <Chips label={labels ? 'State' : null} options={[...all, ...STATE_NAMES.map(s => [s, s])]} value={state}
        onChange={s => set({ state: s, district: '', constituency: '' })} />
      {state ? <Chips label={labels ? 'District' : null} options={[...all, ...districts.map(d => [d, d])]} value={district}
        onChange={d => set({ district: d, constituency: '' })} /> : null}
      {district ? <Chips label={labels ? 'Constituency' : null} options={[...all, ...cons.map(c => [c, c])]} value={constituency}
        onChange={c => set({ constituency: c })} /> : null}
    </View>
  );
}
