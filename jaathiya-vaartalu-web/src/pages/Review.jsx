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
  // News read from an imported e-paper and not added to the feed yet: add it, or delete it.
  const fromImport = async action => {
    if (action === 'delete' && !window.confirm('Delete this news read from the e-paper? This cannot be undone.')) return;
    setBusy(true); setError('');
    try {
      await api(`/imports/${n.sourceRef.paper}/news`, { method: 'POST', body: { ids: [id], action } });
      if (action === 'add') setN(x => ({ ...x, status: 'submitted' })); else go(`/imports/${n.sourceRef.paper}`);
    } catch (e) { setError(errMsg(e)); }
    setBusy(false);
  };
  const back = n?.status === 'imported'
    ? <a className="back" href={`#/imports/${n.sourceRef?.paper}`}><Icon name="back" size={16} />Imported e-paper</a>
    : <a className="back" href="#/"><Icon name="back" size={16} />News</a>;
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
        {n.sourceRef?.paper ? <div className="src-ref">
          <div style={{ flex: '1 1 220px' }}>
            Read from <b>{n.sourceRef.publisher} – {n.sourceRef.editionName}</b>, page {n.sourceRef.page}, {new Date(n.sourceRef.editionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}.
            <div className="muted">Check the text against the printed article before approving.</div>
            <a href={`#/imports/${n.sourceRef.paper}`}>Open the e-paper</a>
          </div>
          {n.sourceRef.clipUrl ? <a href={n.sourceRef.clipUrl} target="_blank" rel="noreferrer" title="Open at original size"><img className="clip" src={n.sourceRef.clipUrl} alt="The article as printed" /></a> : null}
        </div> : null}
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
      {n.status === 'imported' ? <div className="panel">
        <h3>Not in the news feed yet</h3>
        <p className="sub">Add it to the news feed to review and edit it with the rest, or delete it if it isn't needed.</p>
        {error ? <p className="error" role="alert">{error}</p> : null}
        <div className="row">
          <Button onClick={() => fromImport('add')} disabled={busy}><Icon name="plus" size={16} />Add to news feed</Button>
          <div className="spacer" />
          <Button kind="danger" onClick={() => fromImport('delete')} disabled={busy}>Delete</Button>
        </div>
      </div> : n.status !== 'published' ? <div className="panel">
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
