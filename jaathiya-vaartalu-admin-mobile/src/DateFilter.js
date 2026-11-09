import React, { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Button, C, Chips } from './ui';

// Date filter and day grouping for news lists (same file in the Reporter and Desk apps, same choices as the web app).
// The value is a preset key ('', 'today', 'yesterday', '7', '30') or one picked day as 'YYYY-MM-DD'.
// The server reads from/to as whole days in IST.
export const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysAgo = n => iso(new Date(Date.now() - n * 864e5));
const DATES = { '': ['Any date'], today: ['Today', 0, 0], yesterday: ['Yesterday', 1, 1], 7: ['Last 7 days', 6, 0], 30: ['Last 30 days', 29, 0] };
const fromIso = v => { const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d); };
const isDay = v => /^\d{4}-\d{2}-\d{2}$/.test(v);
const shortDate = v => fromIso(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// The API params for a date value: { from, to }, or nothing for "Any date".
export function dateRange(value) {
  if (isDay(value)) return { from: value, to: value };
  const [, a, b] = DATES[value] || [];
  return a === undefined ? {} : { from: daysAgo(a), to: daysAgo(b) };
}

// Day headers like the web app: Today, Yesterday, then "Mon, 2 Nov 2026".
function dayLabel(d) {
  const k = iso(d);
  if (k === daysAgo(0)) return 'Today';
  if (k === daysAgo(1)) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
// SectionList sections, one per day of n[by]. The list arrives newest first, so each day's stories are together.
export function groupByDay(items, by = 'createdAt') {
  const out = [];
  items.forEach(n => {
    const d = new Date(n[by] || n.createdAt), key = iso(d), last = out[out.length - 1];
    if (last && last.key === key) last.data.push(n); else out.push({ key, label: dayLabel(d), data: [n] });
  });
  return out;
}

// The chips: presets, then "Pick date", which opens the phone's calendar (a dialog on Android, a sheet on iOS).
export default function DateFilter({ value, onChange }) {
  const [iosPick, setIosPick] = useState(null);   // the day being chosen in the iOS sheet
  const picked = isDay(value) ? value : '';
  const options = [...Object.entries(DATES).map(([k, [label]]) => [k, label]), ['pick', picked ? shortDate(picked) : 'Pick date', 'calendar-outline']];
  const choose = k => {
    if (k !== 'pick') return onChange(k);
    const start = picked ? fromIso(picked) : new Date();
    if (Platform.OS === 'android') return DateTimePickerAndroid.open({ value: start, mode: 'date', maximumDate: new Date(),
      onChange: (e, d) => { if (e.type === 'set' && d) onChange(iso(d)); } });
    setIosPick(start);
  };
  return (
    <>
      <Chips options={options} value={picked ? 'pick' : value} onChange={choose} icon="calendar-outline" />
      <Modal visible={!!iosPick} transparent animationType="slide" onRequestClose={() => setIosPick(null)}>
        <Pressable style={s.backdrop} onPress={() => setIosPick(null)} accessibilityLabel="Close" />
        <View style={s.sheet}>
          {iosPick ? <DateTimePicker value={iosPick} mode="date" display="inline" maximumDate={new Date()} themeVariant="light"
            accentColor={C.blue} onChange={(_, d) => d && setIosPick(d)} /> : null}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Cancel" kind="secondary" onPress={() => setIosPick(null)} style={{ flex: 1 }} />
            <Button title="Show this day" onPress={() => { onChange(iso(iosPick)); setIosPick(null); }} style={{ flex: 1 }} />
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.35)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 34 },
});
