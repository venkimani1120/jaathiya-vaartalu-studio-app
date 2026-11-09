import React, { useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../auth';
import { errMsg, uploadImages } from '../api';
import { Avatar, Badge, Banner, Button, C, Card, Field, Icon, SectionTitle } from '../ui';

// Same as the web app's "My profile" (same file in the Reporter, Admin and Studio apps): photo, name and phone,
// a link to change the password, and sign out. Email, role and area stay admin-managed.
const ROLES = { reporter: ['Reporter', C.saffron], editor: ['Editor', C.blue], admin: ['Admin', C.ok] };
const fmtDate = d => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export default function ProfileScreen({ navigation }) {
  const { user, updateProfile, signOut } = useAuth();
  const [f, setF] = useState({ name: user.name || '', phone: user.phone || '' });
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [msg, setMsg] = useState({ ok: '', err: '' });
  const set = k => v => { setF(s => ({ ...s, [k]: v })); setMsg({ ok: '', err: '' }); };
  const changed = f.name.trim() !== (user.name || '') || f.phone.trim() !== (user.phone || '');
  const [roleLabel, roleColor] = ROLES[user.role] || [user.role, C.muted];
  const area = [user.constituency, user.district, user.state].filter(Boolean).join(', ');

  const save = async () => {
    if (!f.name.trim()) return setMsg({ ok: '', err: 'Enter your name.' });
    setBusy(true); setMsg({ ok: '', err: '' });
    try { await updateProfile({ name: f.name.trim(), phone: f.phone.trim() }); setMsg({ ok: 'Profile saved.', err: '' }); }
    catch (e) { setMsg({ ok: '', err: errMsg(e) }); } finally { setBusy(false); }
  };

  // A square crop, kept small like the web app's 400px profile pictures.
  const pickPhoto = async camera => {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed', `Allow ${camera ? 'camera' : 'photo'} access in your phone settings to set a profile photo.`);
    const opts = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.5,
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible };
    const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (r.canceled || !r.assets?.length) return;
    setPhotoBusy(true); setMsg({ ok: '', err: '' });
    try {
      const [url] = await uploadImages([{ ...r.assets[0], fileName: 'avatar.jpg', mimeType: 'image/jpeg' }]);
      await updateProfile({ avatar: url });
      setMsg({ ok: 'Profile photo updated.', err: '' });
    } catch (e) { setMsg({ ok: '', err: errMsg(e) }); } finally { setPhotoBusy(false); }
  };
  const removePhoto = async () => {
    setPhotoBusy(true); setMsg({ ok: '', err: '' });
    try { await updateProfile({ avatar: null }); setMsg({ ok: 'Profile photo removed.', err: '' }); }
    catch (e) { setMsg({ ok: '', err: errMsg(e) }); } finally { setPhotoBusy(false); }
  };
  const photoMenu = () => {
    const opts = ['Take photo', 'Choose from gallery', ...(user.avatar ? ['Remove photo'] : []), 'Cancel'];
    const run = i => { if (i === 0) pickPhoto(true); if (i === 1) pickPhoto(false); if (user.avatar && i === 2) removePhoto(); };
    if (Platform.OS === 'ios') return ActionSheetIOS.showActionSheetWithOptions(
      { options: opts, cancelButtonIndex: opts.length - 1, destructiveButtonIndex: user.avatar ? 2 : undefined }, run);
    Alert.alert('Profile photo', undefined, opts.map((text, i) => ({ text, onPress: () => run(i),
      style: i === opts.length - 1 ? 'cancel' : text === 'Remove photo' ? 'destructive' : 'default' })), { cancelable: true });
  };
  const confirmSignOut = () => Alert.alert('Sign out?', 'You will need your email and password to sign in again.', [
    { text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: signOut }]);

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
        <Pressable onPress={photoMenu} disabled={photoBusy} accessibilityRole="button" accessibilityLabel={user.avatar ? 'Change profile photo' : 'Add profile photo'}>
          <Avatar name={user.name} uri={user.avatar} size={96} />
          <View style={s.cam}><Icon name="camera" size={16} color="#fff" /></View>
        </Pressable>
        <Text style={s.name} numberOfLines={1}>{user.name}</Text>
        <Text style={s.email} numberOfLines={1}>{user.email}</Text>
        <Badge text={roleLabel} color={roleColor} />
        <View style={s.photoBtns}>
          <Button title={user.avatar ? 'Change photo' : 'Add photo'} icon="camera-outline" kind="secondary" small loading={photoBusy} onPress={photoMenu} />
          {user.avatar && !photoBusy ? <Button title="Remove" kind="danger" small onPress={removePhoto} /> : null}
        </View>
      </Card>

      <Card>
        <SectionTitle icon="person-outline" title="Details" sub="Your name appears on the news you upload." />
        <Field label="Full name" icon="person-outline" value={f.name} onChangeText={set('name')} autoComplete="name" textContentType="name" />
        <Field label="Phone" icon="call-outline" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" />
        <Field label="Email" icon="mail-outline" value={user.email} editable={false} hint="Ask an admin to change your email." />
        <View style={s.kv}><Text style={s.k}>{user.role === 'reporter' ? 'Reporting area' : 'Area'}</Text><Text style={s.v}>{area || 'Not set'}</Text></View>
        <View style={s.kv}><Text style={s.k}>Member since</Text><Text style={s.v}>{fmtDate(user.createdAt)}</Text></View>
        {msg.err ? <Banner kind="error" style={{ marginTop: 12 }}>{msg.err}</Banner> : null}
        {msg.ok ? <Banner kind="ok" style={{ marginTop: 12 }}>{msg.ok}</Banner> : null}
        <Button title="Save changes" icon="checkmark" onPress={save} loading={busy} disabled={!changed} style={{ marginTop: 12 }} />
      </Card>

      <Card style={{ paddingVertical: 6 }}>
        <Row icon="lock-closed-outline" title="Change password" onPress={() => navigation.navigate('Password')} />
        <View style={s.sep} />
        <Row icon="log-out-outline" title="Sign out" color={C.warn} onPress={confirmSignOut} />
      </Card>
    </ScrollView>
  );
}

const Row = ({ icon, title, color = C.ink, onPress }) => (
  <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.row, pressed && { opacity: 0.6 }]}>
    <Icon name={icon} size={20} color={color === C.ink ? C.blue : color} />
    <Text style={[s.rowText, { color }]}>{title}</Text>
    <Icon name="chevron-forward" size={18} color={C.faint} />
  </Pressable>
);

const s = StyleSheet.create({
  cam: { position: 'absolute', right: 0, bottom: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: C.blue,
    borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 19, fontWeight: '800', color: C.ink, marginTop: 12 },
  email: { fontSize: 14, color: C.muted, marginTop: 2, marginBottom: 8 },
  photoBtns: { flexDirection: 'row', gap: 8, marginTop: 14 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.line, gap: 12 },
  k: { fontSize: 13, color: C.muted },
  v: { flex: 1, fontSize: 13, fontWeight: '700', color: C.ink, textAlign: 'right' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowText: { flex: 1, fontSize: 15, fontWeight: '700' },
  sep: { height: 1, backgroundColor: C.line },
});
