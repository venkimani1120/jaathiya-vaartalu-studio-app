import React, { useState } from 'react';
import { useAuth } from '../auth';
import { errMsg } from '../api';
import PlacePicker from '../PlacePicker';
import { Button, Field } from '../ui';

export default function Signup() {
  const { signUp } = useAuth();
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', state: 'ఆంధ్రప్రదేశ్', district: '', constituency: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const set = k => e => setF(s => ({ ...s, [k]: e.target.value }));
  const go = async e => {
    e.preventDefault();
    setBusy(true); setError('');
    try { setDone((await signUp(f)).message); } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  };
  if (done) return (
    <div className="login panel">
      <h2>Account created</h2>
      <p>{done}</p>
      <a href="#/">Back to sign in</a>
    </div>
  );
  return (
    <form className="login panel" style={{ maxWidth: 640 }} onSubmit={go}>
      <h2>Create a reporter account</h2>
      <p className="muted">New accounts start as Reporter. An admin approves your account before you can sign in.</p>
      <Field label="Full name" value={f.name} onChange={set('name')} autoComplete="name" required />
      <Field label="Email" type="email" value={f.email} onChange={set('email')} autoComplete="email" required />
      <Field label="Phone" type="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" />
      <Field label="Password (at least 8 characters)" type="password" value={f.password} onChange={set('password')} autoComplete="new-password" minLength={8} required />
      <PlacePicker value={f} onChange={p => setF(s => ({ ...s, ...p }))} />
      {error ? <p className="error" role="alert">{error}</p> : null}
      <div className="row">
        <Button type="submit" disabled={busy || !f.name || !f.email || f.password.length < 8 || !f.district}>{busy ? 'Creating…' : 'Create account'}</Button>
        <a href="#/">Back to sign in</a>
      </div>
    </form>
  );
}
