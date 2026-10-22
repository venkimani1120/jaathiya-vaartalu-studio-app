import React, { useEffect, useState } from 'react';
import { api, errMsg } from '../api';
import { SECTIONS } from '../constants';
import { Avatar, Badge, Button, SourceBadge, Field, Icon, Spinner } from '../ui';
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
  const back = <a className="back" href="#/"><Icon name="back" size={16} />News</a>;
  if (!n) return error ? <main className="narrow">{back}<p className="error">{error}</p></main> : <Spinner />;
  return (
    <main className="narrow">
      {back}
      <article className="panel article">
        <div className="row" style={{ marginBottom: 12 }}>
          <Badge status={n.status} />
          <SourceBadge source={n.source} />
          <span className="muted" style={{ fontSize: 13 }}>{SECTIONS[n.section] || n.section} · {[n.constituency, n.district, n.state].filter(Boolean).join(', ')}</span>
        </div>
        <h1>{n.title}</h1>
        {(n.highlights || []).length ? <ul className="highlights">{n.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul> : null}
        {(n.images || []).length ? <div className="review-photos">{n.images.map(u => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" /></a>)}</div> : null}
        <div className="body-text">{n.body}</div>
        <div className="who-cell" style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--line-2)' }}>
          <Avatar user={n.author} size={32} />
          <div><b style={{ fontSize: 14 }}>{n.author?.name || 'Unknown reporter'}</b>
            <div className="muted" style={{ fontSize: 12 }}>Uploaded {new Date(n.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</div></div>
        </div>
      </article>
      {n.status !== 'published' ? <div className="panel">
        <h3>Decision</h3>
        <p className="sub">Approved news goes to the e-paper pool. Sent-back news returns to the reporter with your note.</p>
        <Field label="Note to reporter (needed when sending back)" multiline value={note} onChange={e => setNote(e.target.value)} style={{ minHeight: 80 }} />
        {error ? <p className="error" role="alert">{error}</p> : null}
        <div className="row">
          <Button kind="ok" onClick={() => review('approve')} disabled={busy}><Icon name="check" size={16} />Approve for e-paper</Button>
          <Button kind="danger" onClick={() => review('reject')} disabled={busy}>Send back to reporter</Button>
          <div className="spacer" />
          <Button kind="secondary" onClick={() => go(`/news/${id}`)} disabled={busy}>Edit text or photos</Button>
        </div>
      </div> : null}
    </main>
  );
}
