import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, TextInput, View, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

// Shared look for every screen (same file in the Reporter and Desk apps): navy actions, saffron accents,
// white rounded cards on a light grey page, Ionicons beside labels. The sign-in page set this style.
export const C = { red: '#E31E24', blue: '#1F3C99', blueSoft: '#E8EDF8', saffron: '#F28C28', ink: '#1A2130', muted: '#586274',
  faint: '#8A93A3', line: '#D5DAE2', bg: '#F2F4F7', card: '#FFFFFF', pink: '#D8127A', ok: '#17734A', warn: '#B4231F' };
export const Icon = Ionicons;

export function Button({ title, onPress, kind = 'primary', disabled, loading, icon, small, style }) {
  const s = st[kind] || st.primary;
  const color = kind === 'primary' ? '#fff' : kind === 'danger' ? C.warn : C.blue;
  const off = disabled || loading;
  return (
    <Pressable onPress={onPress} disabled={off} accessibilityRole="button" accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={({ pressed }) => [st.btn, small && st.btnSmall, s, off && (kind === 'primary' ? st.primaryOff : { opacity: 0.5 }),
        pressed && { opacity: 0.85 }, style]}>
      {loading ? <ActivityIndicator color={color} /> : <>
        {icon ? <Ionicons name={icon} size={small ? 16 : 18} color={color} style={{ marginRight: 8 }} /> : null}
        <Text style={[st.btnText, small && { fontSize: 14 }, { color }]} numberOfLines={1}>{title}</Text>
      </>}
    </Pressable>
  );
}
export function IconButton({ icon, onPress, label, color = C.blue, size = 20, style }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => [st.iconBtn, pressed && { opacity: 0.6 }, style]}>
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

// Text input with a label, an optional leading icon and something on the right (e.g. a show-password eye).
export function Field({ label, icon, right, error, hint, inputRef, style, ...props }) {
  const [focused, setFocused] = useState(false);
  const tint = error ? C.warn : focused ? C.blue : C.faint;
  const multi = props.multiline;
  return (
    <View style={{ marginBottom: 16 }}>
      {label ? <Text style={st.label}>{label}</Text> : null}
      <View style={[st.inputRow, multi && st.inputMulti, focused && st.inputFocus, error && { borderColor: C.warn },
        props.editable === false && st.inputOff]}>
        {icon ? <Ionicons name={icon} size={20} color={tint} style={{ marginRight: 10, marginTop: multi ? 2 : 0 }} /> : null}
        <TextInput ref={inputRef} placeholderTextColor="#9AA3B2" accessibilityLabel={label}
          style={[st.input, multi && { minHeight: 110, textAlignVertical: 'top', paddingVertical: 0 }, style]}
          {...props} onFocus={e => { setFocused(true); props.onFocus?.(e); }} onBlur={e => { setFocused(false); props.onBlur?.(e); }} />
        {right}
      </View>
      {hint ? <Text style={st.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Chips({ label, options, value, onChange, icon }) {
  return (
    <View style={{ marginBottom: 12 }}>
      {label ? <Text style={st.label}>{label}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
        {options.map(([k, v, ic]) => {
          const on = value === k;
          return (
            <Pressable key={k} onPress={() => onChange(k)} style={[st.chip, on && st.chipOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
              {ic || (on && icon) ? <Ionicons name={ic || icon} size={14} color={on ? '#fff' : C.muted} style={{ marginRight: 5 }} /> : null}
              <Text style={[st.chipText, on && { color: '#fff', fontWeight: '700' }]}>{v}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// Status label: coloured text and dot on a light tint of the same colour.
export const Badge = ({ text, color = C.muted }) => (
  <View style={[st.badge, { backgroundColor: color + '1A', borderColor: color + '40' }]}>
    <View style={[st.dot, { backgroundColor: color }]} />
    <Text style={[st.badgeText, { color }]}>{text}</Text>
  </View>
);

export const Card = ({ children, style, accent }) => <View style={[st.card, accent && { borderTopWidth: 4, borderTopColor: C.saffron }, style]}>{children}</View>;

// Card heading: icon in a soft square, title and an optional line under it.
export function SectionTitle({ icon, title, sub, right }) {
  return (
    <View style={st.secRow}>
      {icon ? <View style={st.secIcon}><Ionicons name={icon} size={18} color={C.blue} /></View> : null}
      <View style={{ flex: 1 }}>
        <Text style={st.secTitle}>{title}</Text>
        {sub ? <Text style={st.secSub}>{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
}

// kind: info | warn | error | ok
const BANNERS = { info: [C.blue, '#EEF2FB', 'information-circle'], warn: ['#8A4B00', '#FFF4E5', 'time'],
  error: [C.warn, '#FDECEC', 'alert-circle'], ok: [C.ok, '#E9F6EF', 'checkmark-circle'] };
export function Banner({ kind = 'info', icon, children, style }) {
  const [fg, bg, ic] = BANNERS[kind];
  return (
    <View style={[st.banner, { backgroundColor: bg, borderColor: fg + '33' }, style]} accessibilityRole={kind === 'error' ? 'alert' : undefined}>
      <Ionicons name={icon || ic} size={18} color={fg} style={{ marginTop: 1 }} />
      <Text style={[st.bannerText, { color: fg }]}>{children}</Text>
    </View>
  );
}

export function EmptyState({ icon = 'newspaper-outline', title, text, children }) {
  return (
    <View style={st.empty}>
      <View style={st.emptyIcon}><Ionicons name={icon} size={30} color={C.blue} /></View>
      <Text style={st.emptyTitle}>{title}</Text>
      {text ? <Text style={st.emptyText}>{text}</Text> : null}
      {children}
    </View>
  );
}

export const Loading = () => <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg }}><ActivityIndicator size="large" color={C.blue} /></View>;

// Small icon + text, e.g. a place or an author under a headline.
export const Meta = ({ icon, text, color = C.muted }) => text ? (
  <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
    <Ionicons name={icon} size={13} color={color} style={{ marginRight: 4 }} />
    <Text style={{ color, fontSize: 12 }} numberOfLines={1}>{text}</Text>
  </View>
) : null;

// Profile photo, or the initials when there is none (or it fails to load).
export function Avatar({ name = '', uri, size = 40 }) {
  const [broken, setBroken] = useState(null);
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (uri && broken !== uri) return <Image source={{ uri }} style={[box, { backgroundColor: C.blueSoft }]} onError={() => setBroken(uri)} />;
  return (
    <View style={[box, { backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: C.blue, fontWeight: '800', fontSize: size * 0.38 }}>
        {name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'}</Text>
    </View>
  );
}

// One story in a list: photo (or a placeholder icon), headline, where/who, status badges, editor's note.
export function NewsItem({ news: n, badges = [], author, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [st.card, st.newsRow, pressed && { opacity: 0.85 }]}>
      {n.images?.[0] ? <Image source={{ uri: n.images[0] }} style={st.thumb} />
        : <View style={[st.thumb, st.thumbEmpty]}><Ionicons name="image-outline" size={24} color={C.faint} /></View>}
      <View style={{ flex: 1 }}>
        <Text style={st.newsTitle} numberOfLines={2}>{n.title}</Text>
        <View style={st.metaRow}>
          <Meta icon="location-outline" text={n.constituency || n.district} />
          {author ? <Meta icon="person-outline" text={author} /> : null}
        </View>
        <View style={st.badgeRow}>{badges.filter(([t]) => t).map(([t, c]) => <Badge key={t} text={t} color={c} />)}</View>
        {n.status === 'rejected' && n.reviewNote ? (
          <View style={st.note}><Ionicons name="chatbubble-ellipses-outline" size={13} color={C.warn} style={{ marginTop: 2 }} />
            <Text style={st.noteText} numberOfLines={3}>Editor: {n.reviewNote}</Text></View>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.faint} style={{ alignSelf: 'center' }} />
    </Pressable>
  );
}

// Floating "add" button above the bottom edge (and the phone's gesture bar).
export function Fab({ icon = 'add', title, onPress, disabled }) {
  const { bottom } = useSafeAreaInsets();
  return (
    <View style={[st.fabWrap, { bottom: 16 + bottom }]} pointerEvents="box-none">
      <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled: !!disabled }}
        style={({ pressed }) => [st.fab, disabled && st.primaryOff, pressed && { opacity: 0.85 }]}>
        <Ionicons name={icon} size={22} color="#fff" style={{ marginRight: 6 }} />
        <Text style={st.fabText}>{title}</Text>
      </Pressable>
    </View>
  );
}

// Shared navigation header: navy bar, white title.
export const headerStyle = { headerStyle: { backgroundColor: C.blue }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '700' },
  headerShadowVisible: false, contentStyle: { backgroundColor: C.bg } };

const shadow = { shadowColor: '#0B1A3F', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 };
const st = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 50, paddingHorizontal: 16, borderRadius: 12 },
  btnSmall: { height: 40, paddingHorizontal: 12, borderRadius: 10 },
  primary: { backgroundColor: C.blue },
  primaryOff: { backgroundColor: '#9AA8CF' },
  secondary: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: C.blue },
  ghost: { backgroundColor: C.blueSoft },
  danger: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: C.warn },
  btnText: { fontWeight: '700', fontSize: 15 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, fontWeight: '600', color: C.ink, marginBottom: 6 },
  hint: { fontSize: 12, color: C.muted, marginTop: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: C.line, backgroundColor: '#FAFBFC' },
  inputMulti: { alignItems: 'flex-start', paddingVertical: 14 },
  inputFocus: { borderColor: C.blue, backgroundColor: '#fff' },
  inputOff: { backgroundColor: '#F0F2F5' },
  input: { flex: 1, fontSize: 16, color: C.ink, paddingVertical: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', height: 36, borderWidth: 1, borderColor: C.line, backgroundColor: '#fff', borderRadius: 99, paddingHorizontal: 14, marginRight: 8 },
  chipOn: { backgroundColor: C.blue, borderColor: C.blue },
  chipText: { color: C.ink, fontSize: 14 },
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, borderWidth: 1 },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12, ...shadow },
  secRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  secIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  secTitle: { fontSize: 16, fontWeight: '800', color: C.ink },
  secSub: { fontSize: 12, color: C.muted, marginTop: 1 },
  banner: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  bannerText: { flex: 1, fontSize: 14, lineHeight: 20 },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: C.ink, textAlign: 'center' },
  newsRow: { flexDirection: 'row', gap: 12, padding: 12, marginBottom: 10 },
  thumb: { width: 84, height: 68, borderRadius: 10 },
  thumbEmpty: { backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  newsTitle: { fontSize: 15, fontWeight: '700', color: C.ink, lineHeight: 21 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4, marginBottom: 6 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  note: { flexDirection: 'row', gap: 5, marginTop: 8, padding: 8, borderRadius: 8, backgroundColor: '#FDECEC' },
  noteText: { flex: 1, color: C.warn, fontSize: 12, lineHeight: 17 },
  fabWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  fab: { flexDirection: 'row', alignItems: 'center', height: 54, paddingHorizontal: 22, borderRadius: 27, backgroundColor: C.blue,
    shadowColor: '#0B1A3F', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  emptyText: { fontSize: 14, color: C.muted, textAlign: 'center', marginTop: 6, lineHeight: 20 },
});
