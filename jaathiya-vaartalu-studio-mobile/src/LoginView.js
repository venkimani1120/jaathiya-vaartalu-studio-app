import React, { useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from './auth';
import { errMsg } from './api';
import { Banner, Button, C, Field } from './ui';

// Sign-in page shared by the Reporter, Desk and Studio apps (same file in both): brand on top, one card with
// the form, then whatever the app adds below it (`footer`). Centred and capped in width on tablets.

export default function LoginView({ badge, badgeIcon, subtitle, footer }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const passRef = useRef(null);
  const ready = !!email.trim() && !!password && !busy;
  const go = async () => {
    if (!ready) return;
    setBusy(true); setError('');
    try { await signIn(email, password); } catch (e) { setError(errMsg(e)); setBusy(false); }
  };

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={s.column}>
            <View style={s.brand}>
              <Image source={require('../assets/logo.png')} style={s.logo} resizeMode="contain" accessibilityLabel="Jaathiya Vaartalu News" />
              <Text style={s.masthead}>జాతియ వార్తలు</Text>
              <View style={s.badge}>
                <Ionicons name={badgeIcon} size={14} color={C.blue} />
                <Text style={s.badgeText}>{badge}</Text>
              </View>
            </View>

            <View style={s.card}>
              <Text style={s.title}>Welcome back</Text>
              <Text style={s.subtitle}>{subtitle}</Text>

              {error ? <Banner kind="error" style={{ marginBottom: 16 }}>{error}</Banner> : null}

              <Field icon="mail-outline" label="Email" value={email} error={!!error}
                onChangeText={t => { setEmail(t); setError(''); }} placeholder="you@example.com"
                keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress"
                returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => passRef.current?.focus()} />
              <Field icon="lock-closed-outline" label="Password" value={password} error={!!error} inputRef={passRef}
                onChangeText={t => { setPassword(t); setError(''); }} placeholder="Your password"
                secureTextEntry={!show} autoCapitalize="none" autoCorrect={false} autoComplete="password" textContentType="password"
                returnKeyType="go" onSubmitEditing={go}
                right={(
                  <Pressable onPress={() => setShow(v => !v)} hitSlop={12} accessibilityRole="button" accessibilityLabel={show ? 'Hide password' : 'Show password'}>
                    <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color="#8A93A3" />
                  </Pressable>
                )} />

              <Button title="Sign in" icon="log-in-outline" onPress={go} disabled={!ready} loading={busy} style={{ marginTop: 4 }} />
            </View>

            {footer}
            <Text style={s.copy}>© Jaathiya Vaartalu News</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// A secondary action under the card, e.g. "Create a reporter account".
export function LoginLink({ icon, title, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.outline, pressed && { backgroundColor: '#EEF2FB' }]}>
      <Ionicons name={icon} size={18} color={C.blue} style={{ marginRight: 8 }} />
      <Text style={s.outlineText}>{title}</Text>
    </Pressable>
  );
}
// A short note with an icon, e.g. how new editors get access.
export function LoginNote({ icon = 'information-circle-outline', children }) {
  return (
    <View style={s.note}>
      <Ionicons name={icon} size={18} color={C.muted} style={{ marginTop: 1 }} />
      <Text style={s.noteText}>{children}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 24 },
  column: { width: '100%', maxWidth: 440, alignSelf: 'center' },
  brand: { alignItems: 'center', marginBottom: 20 },
  logo: { width: 150, height: 129 },
  masthead: { marginTop: 6, fontSize: 26, fontWeight: '800', color: C.red, letterSpacing: 0.3 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingVertical: 5, paddingHorizontal: 12,
    borderRadius: 99, backgroundColor: '#E8EDF8', borderWidth: 1, borderColor: '#D3DCF0' },
  badgeText: { color: C.blue, fontWeight: '700', fontSize: 13, letterSpacing: 0.2 },
  card: { backgroundColor: C.card, borderRadius: 18, padding: 22, borderTopWidth: 4, borderTopColor: C.saffron,
    shadowColor: '#0B1A3F', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  title: { fontSize: 22, fontWeight: '800', color: C.ink },
  subtitle: { fontSize: 14, color: C.muted, marginTop: 4, marginBottom: 20, lineHeight: 20 },
  outline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 50, marginTop: 16, borderRadius: 12,
    borderWidth: 1.5, borderColor: C.blue, backgroundColor: '#fff' },
  outlineText: { color: C.blue, fontSize: 15, fontWeight: '700' },
  note: { flexDirection: 'row', gap: 8, marginTop: 16, paddingHorizontal: 4 },
  noteText: { flex: 1, color: C.muted, fontSize: 13, lineHeight: 19 },
  copy: { textAlign: 'center', color: '#9AA3B2', fontSize: 12, marginTop: 24 },
});
