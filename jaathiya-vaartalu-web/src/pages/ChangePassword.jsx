import React, { useState } from 'react';
import { useAuth } from '../auth';
import { errMsg } from '../api';
import { Button, Field } from '../ui';

export default function ChangePassword() {
  const { changePassword } = useAuth();
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const set = k => e => { setF(s => ({ ...s, [k]: e.target.value })); setDone(false); };
  const mismatch = f.confirm && f.next !== f.confirm;

  const go = async e => {
    e.preventDefault();
    setError('');
    if (f.next.length < 8) return setError('New password must be at least 8 characters.');
    if (f.next !== f.confirm) return setError('The new passwords do not match.');
    setBusy(true);
    try { await changePassword(f.current, f.next); setF({ current: '', next: '', confirm: '' }); setDone(true); }
    catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  };

  return (
    <main className="narrow">
      <div className="page-head"><div><h2>Change password</h2><p>You stay signed in here. Other devices are signed out.</p></div></div>
      <form className="panel" onSubmit={go} style={{ maxWidth: 480 }}>
        <Field label="Current password" type="password" value={f.current} onChange={set('current')} autoComplete="current-password" required />
        <Field label="New password" type="password" value={f.next} onChange={set('next')} autoComplete="new-password" minLength={8} required hint="At least 8 characters." />
        <Field label="Confirm new password" type="password" value={f.confirm} onChange={set('confirm')} autoComplete="new-password" required
          hint={mismatch ? 'Does not match the new password.' : undefined} />
        {error ? <p className="error" role="alert">{error}</p> : null}
        {done ? <p className="success" role="status">Password changed.</p> : null}
        <div className="row" style={{ marginTop: 8 }}>
          <Button type="submit" disabled={busy || !f.current || f.next.length < 8 || f.next !== f.confirm}>{busy ? 'Saving…' : 'Change password'}</Button>
          <a href="#/profile">Back to profile</a>
        </div>
      </form>
    </main>
  );
}
