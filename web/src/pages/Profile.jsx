import React, { useRef, useState } from 'react';
import { useAuth } from '../auth';
import { errMsg, uploadImages } from '../api';
import { Avatar, Button, Field, Icon } from '../ui';

// Shrinks a picked photo to a 400px square-ish JPEG so profile pictures stay small.
function shrink(file, max = 400) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, max / Math.min(im.width, im.height));
      const c = document.createElement('canvas');
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => (b ? resolve(new File([b], 'avatar.jpg', { type: 'image/jpeg' })) : reject(new Error('Could not read this photo.'))), 'image/jpeg', 0.85);
    };
    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read this photo. Try a JPG or PNG.')); };
    im.src = url;
  });
}

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const [f, setF] = useState({ name: user.name || '', phone: user.phone || '' });
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [msg, setMsg] = useState({ ok: '', err: '' });
  const pick = useRef(null);
  const set = k => e => setF(s => ({ ...s, [k]: e.target.value }));
  const changed = f.name.trim() !== (user.name || '') || f.phone.trim() !== (user.phone || '');

  const save = async e => {
    e.preventDefault();
    if (!f.name.trim()) return setMsg({ ok: '', err: 'Enter your name.' });
    setBusy(true); setMsg({ ok: '', err: '' });
    try { await updateProfile({ name: f.name.trim(), phone: f.phone.trim() }); setMsg({ ok: 'Profile saved.', err: '' }); }
    catch (err) { setMsg({ ok: '', err: errMsg(err) }); } finally { setBusy(false); }
  };
  const setPhoto = async file => {
    if (!file) return;
    setPhotoBusy(true); setMsg({ ok: '', err: '' });
    try {
      const [url] = await uploadImages([await shrink(file)]);
      await updateProfile({ avatar: url });
      setMsg({ ok: 'Profile photo updated.', err: '' });
    } catch (err) { setMsg({ ok: '', err: errMsg(err) }); } finally { setPhotoBusy(false); }
  };
  const removePhoto = async () => {
    setPhotoBusy(true); setMsg({ ok: '', err: '' });
    try { await updateProfile({ avatar: null }); setMsg({ ok: 'Profile photo removed.', err: '' }); }
    catch (err) { setMsg({ ok: '', err: errMsg(err) }); } finally { setPhotoBusy(false); }
  };

  const area = [user.constituency, user.district, user.state].filter(Boolean).join(', ');
  return (
    <main className="narrow">
      <div className="page-head"><div><h2>My profile</h2><p>Your photo and contact details.</p></div></div>

      <section className="panel">
        <div className="profile-top">
          <Avatar user={user} size={96} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <h3>{user.name}</h3>
            <div className="muted" style={{ fontSize: 14 }}>{user.email}</div>
            <span className="role-pill">{user.role}</span>
          </div>
          <div className="row">
            <Button kind="secondary" onClick={() => pick.current.click()} disabled={photoBusy}>
              <Icon name="camera" size={16} />{photoBusy ? 'Uploading…' : user.avatar ? 'Change photo' : 'Add photo'}
            </Button>
            {user.avatar ? <Button kind="danger" onClick={removePhoto} disabled={photoBusy}>Remove</Button> : null}
            <input ref={pick} className="hidden-input" type="file" accept="image/jpeg,image/png,image/webp"
              onChange={e => { setPhoto(e.target.files[0]); e.target.value = ''; }} />
          </div>
        </div>
      </section>

      <form className="panel" onSubmit={save}>
        <h3>Details</h3>
        <p className="sub">Your name appears on the news you upload.</p>
        <div className="grid2">
          <Field label="Full name" value={f.name} onChange={set('name')} autoComplete="name" required />
          <Field label="Phone" type="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" />
        </div>
        <Field label="Email" value={user.email} disabled hint="Ask an admin to change your email." />
        <div className="kv">
          <div><span>Reporting area</span><b>{area || 'Not set'}</b></div>
          <div><span>Member since</span><b>{user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</b></div>
        </div>
        {msg.err ? <p className="error" role="alert">{msg.err}</p> : null}
        {msg.ok ? <p className="success" role="status">{msg.ok}</p> : null}
        <div className="row" style={{ marginTop: 16 }}>
          <Button type="submit" disabled={busy || !changed}>{busy ? 'Saving…' : 'Save changes'}</Button>
          <a href="#/password" className="row" style={{ gap: 6 }}><Icon name="lock" size={16} />Change password</a>
        </div>
      </form>
    </main>
  );
}
