import React, { useState } from 'react';
import { useAuth } from '../auth';
import { errMsg } from '../api';
import PlacePicker from '../PlacePicker';
import { AuthShell, Button, Field, Icon } from '../ui';

const ROLES = [
  ['reporter', 'Reporter', 'news', 'Upload news from your area.'],
  ['editor', 'Editor', 'check', 'Review news and build the e-paper.'],
];

export default function Signup() {
  const { signUp } = useAuth();
  const [f, setF] = useState({ role: 'reporter', name: '', email: '', phone: '', password: '', state: 'ఆంధ్రప్రదేశ్', district: '', constituency: '' });
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
    <AuthShell subtitle="Request sent">
      <p className="success" role="status">{done}</p>
      <p className="auth-foot"><a href="#/">Back to sign in</a></p>
    </AuthShell>
  );
  return (
    <AuthShell subtitle="Create an account" wide>
    <form onSubmit={go}>
      <div className="field">
        <span>I am joining as</span>
        <div className="role-pick" role="radiogroup" aria-label="Account type">
          {ROLES.map(([k, label, icon, text]) => (
            <button type="button" key={k} role="radio" aria-checked={f.role === k} className={`role-opt${f.role === k ? ' on' : ''}`} onClick={() => setF(s => ({ ...s, role: k }))}>
              <Icon name={icon} size={20} /><b>{label}</b><small>{text}</small>
            </button>
          ))}
        </div>
      </div>
      <p className="notice">An Admin checks every new account. You can sign in once it is approved.</p>
      <div className="grid2">
        <Field label="Full name" value={f.name} onChange={set('name')} autoComplete="name" required />
        <Field label="Phone" type="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" />
      </div>
      <Field label="Email" type="email" value={f.email} onChange={set('email')} autoComplete="email" required />
      <Field label="Password" type="password" value={f.password} onChange={set('password')} autoComplete="new-password" minLength={8} required hint="At least 8 characters." />
      <div className="field" style={{ marginBottom: 0 }}><span>{f.role === 'reporter' ? 'Where you report from' : 'Your desk location (optional)'}</span></div>
      <PlacePicker value={f} onChange={p => setF(s => ({ ...s, ...p }))} />
      {error ? <p className="error" role="alert">{error}</p> : null}
      <div className="row">
        <Button type="submit" disabled={busy || !f.name || !f.email || f.password.length < 8 || (f.role === 'reporter' && !f.district)}>{busy ? 'Sending…' : 'Request account'}</Button>
        <a href="#/">Back to sign in</a>
      </div>
    </form>
    </AuthShell>
  );
}
