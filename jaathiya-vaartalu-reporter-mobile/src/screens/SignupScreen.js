import React, { useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useAuth } from '../auth';
import { errMsg } from '../api';
import PlacePicker from '../PlacePicker';
import { Banner, Button, C, Card, Field, IconButton, SectionTitle } from '../ui';

export default function SignupScreen({ navigation }) {
  const { signUp } = useAuth();
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', state: 'ఆంధ్రప్రదేశ్', district: '', constituency: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const refs = { email: useRef(null), phone: useRef(null), password: useRef(null) };
  const set = k => v => setF(s => ({ ...s, [k]: v }));
  const short = f.password.length > 0 && f.password.length < 8;
  const ready = f.name.trim() && f.email.trim() && f.password.length >= 8 && f.district && !busy;
  const go = async () => {
    setBusy(true);
    try {
      const r = await signUp(f);
      Alert.alert('Account created', r.message, [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) { Alert.alert('Could not create account', errMsg(e)); } finally { setBusy(false); }
  };
  const next = k => ({ returnKeyType: 'next', submitBehavior: 'submit', onSubmitEditing: () => refs[k].current?.focus() });
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Banner kind="info">New accounts start as Reporter. An admin approves your account before you can sign in.</Banner>
        <Card>
          <SectionTitle icon="person-outline" title="Your details" />
          <Field label="Full name" icon="person-outline" value={f.name} onChangeText={set('name')} autoComplete="name" textContentType="name" {...next('email')} />
          <Field label="Email" icon="mail-outline" inputRef={refs.email} value={f.email} onChangeText={set('email')} keyboardType="email-address"
            autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" {...next('phone')} />
          <Field label="Phone" icon="call-outline" inputRef={refs.phone} value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad"
            autoComplete="tel" textContentType="telephoneNumber" {...next('password')} />
          <Field label="Password" icon="lock-closed-outline" inputRef={refs.password} value={f.password} onChangeText={set('password')}
            secureTextEntry={!show} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword"
            error={short} hint={short ? `${8 - f.password.length} more characters needed` : 'At least 8 characters'}
            right={<IconButton icon={show ? 'eye-off-outline' : 'eye-outline'} color={C.faint} label={show ? 'Hide password' : 'Show password'}
              onPress={() => setShow(v => !v)} style={{ width: 32, height: 32 }} />} />
        </Card>
        <Card>
          <SectionTitle icon="location-outline" title="Where you report from" sub="Choose your district and constituency" />
          <PlacePicker value={f} onChange={p => setF(s => ({ ...s, ...p }))} />
        </Card>
        <Button title="Create account" icon="person-add-outline" onPress={go} disabled={!ready} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
