import React, { useState } from 'react';
import { useAuth } from '../auth';
import { errMsg } from '../api';
import { Button, Field } from '../ui';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const go = async e => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await signIn(email, password); } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <form className="login panel" onSubmit={go}>
      <h1 className="masthead">జాతియ వార్తలు</h1>
      <div className="band">Reporter</div>
      <Field label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
      <Field label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
      {error ? <p className="error" role="alert">{error}</p> : null}
      <Button type="submit" disabled={busy || !email || !password} style={{ width: '100%' }}>{busy ? 'Signing in…' : 'Sign in'}</Button>
      <p className="muted" style={{ textAlign: 'center' }}>New reporter? <a href="#/signup">Create an account</a></p>
    </form>
  );
}
