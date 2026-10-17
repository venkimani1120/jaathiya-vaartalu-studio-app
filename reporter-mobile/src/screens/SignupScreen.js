import React, { useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { useAuth } from '../auth';
import { errMsg } from '../api';
import PlacePicker from '../PlacePicker';
import { Button, Field, C } from '../ui';

export default function SignupScreen({ navigation }) {
  const { signUp } = useAuth();
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', state: 'ఆంధ్రప్రదేశ్', district: '', constituency: '' });
  const [busy, setBusy] = useState(false);
  const set = k => v => setF(s => ({ ...s, [k]: v }));
  const go = async () => {
    setBusy(true);
    try {
      const r = await signUp(f);
      Alert.alert('Account created', r.message, [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) { Alert.alert('Could not create account', errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
      <Text style={{ color: C.muted, marginBottom: 16 }}>New accounts start as Reporter. An admin approves your account and can change your role.</Text>
      <Field label="Full name" value={f.name} onChangeText={set('name')} />
      <Field label="Email" value={f.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
      <Field label="Phone" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
      <Field label="Password (at least 8 characters)" value={f.password} onChangeText={set('password')} secureTextEntry />
      <PlacePicker value={f} onChange={p => setF(s => ({ ...s, ...p }))} />
      <Button title={busy ? 'Creating…' : 'Create account'} onPress={go} disabled={busy || !f.name || !f.email || f.password.length < 8 || !f.district} />
    </ScrollView>
  );
}
