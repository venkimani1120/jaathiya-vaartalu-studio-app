import React, { useEffect, useState } from 'react';
import { api, errMsg } from '../api';
import { SECTIONS } from '../constants';
import { Badge, Button, Field, Spinner } from '../ui';
import { go } from '../router';

export default function Review({ id }) {
  const [n, setN] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    api(`/news/${id}`).then(r => { setN(r.news); setNote(r.news.reviewNote || ''); }).catch(e => setError(errMsg(e)));
  }, [id]);

  const review = async action => {
    if (action === 'reject' && !note.trim()) return setError('Tell the reporter what to fix before sending it back.');
    setBusy(true); setError('');
    try { await api(`/news/${id}/review`, { method: 'POST', body: { action, note } }); go('/'); }
    catch (e) { setError(errMsg(e)); setBusy(false); }
  };
  if (!n) return error ? <main className="narrow"><a href="#/">← Back</a><p className="error">{error}</p></main> : <Spinner />;
  return (
    <main className="narrow">
      <div className="row" style={{ marginBottom: 12 }}><a href="#/">← Back</a><div className="spacer" /><Badge status={n.status} /></div>
      <article className="panel">
        <h1 style={{ color: 'var(--red)', fontSize: 28 }}>{n.title}</h1>
        {(n.highlights || []).length ? <ul className="highlights">{n.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul> : null}
        {(n.images || []).length ? <div className="review-photos">{n.images.map(u => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" /></a>)}</div> : null}
        <p className="muted">{[n.constituency, n.district, n.state].filter(Boolean).join(', ')} · {SECTIONS[n.section] || n.section} · {n.author?.name}</p>
        <div className="body-text">{n.body}</div>
      </article>
      {n.status !== 'published' ? <div className="panel">
        <Field label="Note to reporter (needed when sending back)" multiline value={note} onChange={e => setNote(e.target.value)} style={{ minHeight: 70 }} />
        {error ? <p className="error" role="alert">{error}</p> : null}
        <div className="row">
          <Button kind="ok" onClick={() => review('approve')} disabled={busy}>Approve for e-paper</Button>
          <Button kind="danger" onClick={() => review('reject')} disabled={busy}>Send back to reporter</Button>
          <div className="spacer" />
          <Button kind="secondary" onClick={() => go(`/news/${id}`)} disabled={busy}>Edit text or photos</Button>
        </div>
      </div> : null}
    </main>
  );
}
