import React from 'react';
import { Pressable, Text, TextInput, View, StyleSheet, ScrollView } from 'react-native';

export const C = { red: '#E31E24', blue: '#1F3C99', ink: '#1A2130', muted: '#586274', line: '#D5DAE2', bg: '#F2F4F7', card: '#FFFFFF', pink: '#D8127A', ok: '#17734A', warn: '#B4231F' };

export function Button({ title, onPress, kind = 'primary', disabled, style }) {
  const s = kind === 'primary' ? st.primary : kind === 'danger' ? st.danger : st.secondary;
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button"
      style={({ pressed }) => [st.btn, s, (pressed || disabled) && { opacity: 0.6 }, style]}>
      <Text style={[st.btnText, kind !== 'primary' && { color: kind === 'danger' ? C.warn : C.blue }]}>{title}</Text>
    </Pressable>
  );
}
export function Field({ label, style, ...props }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={st.label}>{label}</Text>
      <TextInput placeholderTextColor="#9AA3B2" style={[st.input, props.multiline && { minHeight: 120, textAlignVertical: 'top' }, style]} {...props} />
    </View>
  );
}
export function Chips({ label, options, value, onChange }) {
  return (
    <View style={{ marginBottom: 12 }}>
      {label ? <Text style={st.label}>{label}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {options.map(([k, v]) => (
          <Pressable key={k} onPress={() => onChange(k)} style={[st.chip, value === k && st.chipOn]} accessibilityState={{ selected: value === k }}>
            <Text style={[st.chipText, value === k && { color: '#fff' }]}>{v}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
export const Badge = ({ text, color }) => <Text style={[st.badge, { backgroundColor: color }]}>{text}</Text>;

const st = StyleSheet.create({
  btn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center' },
  primary: { backgroundColor: C.blue },
  secondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.line },
  danger: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.warn },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  label: { fontSize: 13, color: C.muted, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: C.line, backgroundColor: '#fff', borderRadius: 10, padding: 12, fontSize: 16, color: C.ink },
  chip: { borderWidth: 1, borderColor: C.line, backgroundColor: '#fff', borderRadius: 99, paddingVertical: 6, paddingHorizontal: 12, marginRight: 8 },
  chipOn: { backgroundColor: C.blue, borderColor: C.blue },
  chipText: { color: C.ink, fontSize: 14 },
  badge: { color: '#fff', fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, overflow: 'hidden', alignSelf: 'flex-start' },
});
