import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../auth';
import { errMsg } from '../api';
import { Button, Field, C } from '../ui';

export default function LoginScreen({ navigation }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const go = async () => {
    setBusy(true); setError('');
    try { await signIn(email, password); } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#fff' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 60 }}>
        <Image source={require('../../assets/logo.png')} style={{ width: 180, height: 155, alignSelf: 'center', marginBottom: 8 }} resizeMode="contain" accessibilityLabel="Jaathiya Vaartalu News" />
        <Text style={{ fontSize: 44, fontWeight: '900', color: C.red, textAlign: 'center' }}>జాతియ వార్తలు</Text>
        <View style={{ backgroundColor: C.red, padding: 6, marginTop: 8, marginBottom: 32 }}>
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700' }}>Reporter</Text>
        </View>
        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
        {error ? <Text style={{ color: C.warn, marginBottom: 12 }}>{error}</Text> : null}
        <Button title={busy ? 'Signing in…' : 'Sign in'} onPress={go} disabled={busy || !email || !password} />
        <Button title="Create a reporter account" kind="secondary" style={{ marginTop: 12 }} onPress={() => navigation.navigate('Signup')} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
