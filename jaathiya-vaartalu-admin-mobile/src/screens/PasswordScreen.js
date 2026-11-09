import React, { useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { useAuth } from '../auth';
import { errMsg } from '../api';
import { Banner, Button, C, Card, Field, Icon, SectionTitle } from '../ui';

// Same rules as the web app's "Change password": at least 8 characters, typed twice. This phone stays
// signed in (the server sends fresh tokens); other devices are signed out.
export default function PasswordScreen({ navigation }) {
  const { changePassword } = useAuth();
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const set = k => v => { setF(s => ({ ...s, [k]: v })); setDone(false); setError(''); };
  const mismatch = !!f.confirm && f.next !== f.confirm;

  const go = async () => {
    if (f.next.length < 8) return setError('New password must be at least 8 characters.');
    if (f.next !== f.confirm) return setError('The new passwords do not match.');
    setBusy(true); setError('');
    try { await changePassword(f.current, f.next); setF({ current: '', next: '', confirm: '' }); setDone(true); }
    catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };

  const eye = (
    <Pressable onPress={() => setShow(v => !v)} hitSlop={10} accessibilityRole="button" accessibilityLabel={show ? 'Hide passwords' : 'Show passwords'}>
      <Icon name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.faint} />
    </Pressable>
  );
  const pw = { secureTextEntry: !show, autoCapitalize: 'none', autoCorrect: false };
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Card>
        <SectionTitle icon="lock-closed-outline" title="Change password" sub="You stay signed in here. Other devices are signed out." />
        <Field label="Current password" icon="key-outline" right={eye} value={f.current} onChangeText={set('current')} {...pw}
          autoComplete="current-password" textContentType="password" />
        <Field label="New password" icon="lock-closed-outline" value={f.next} onChangeText={set('next')} {...pw}
          autoComplete="new-password" textContentType="newPassword" hint="At least 8 characters." />
        <Field label="Confirm new password" icon="lock-closed-outline" value={f.confirm} onChangeText={set('confirm')} {...pw}
          autoComplete="new-password" textContentType="newPassword" error={mismatch} hint={mismatch ? 'Does not match the new password.' : undefined} />
        {error ? <Banner kind="error">{error}</Banner> : null}
        {done ? <Banner kind="ok">Password changed.</Banner> : null}
        <Button title="Change password" icon="checkmark" onPress={go} loading={busy}
          disabled={!f.current || f.next.length < 8 || f.next !== f.confirm} />
        {done ? <Button title="Back to profile" kind="ghost" onPress={() => navigation.goBack()} style={{ marginTop: 10 }} /> : null}
      </Card>
    </ScrollView>
  );
}
