import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { api, errMsg } from '../api';
import { Badge, Button, Chips, Spinner } from '../ui';
import { go } from '../router';

const FILTERS = [['', 'All'], ['draft', 'Drafts'], ['submitted', 'Waiting'], ['rejected', 'Sent back'], ['approved,published', 'Approved']];

export default function Home() {
  const { user } = useAuth();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [items, setItems] = useState(null);
  const [quota, setQuota] = useState(null);
  const [error, setError] = useState('');

  // The server only returns the reporter's own cards.
  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      try {
        const [news, qt] = await Promise.all([api('/news', { params: { limit: 100, status, q } }), api('/news/quota/today')]);
        if (live) { setItems(news.items); setQuota(qt); setError(''); }
      } catch (e) { if (live) setError(errMsg(e)); }
    }, q ? 300 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [status, q]);

  const full = quota && quota.remaining === 0;
  return (
    <main>
      <div className="panel row">
        <div>
          <strong>{user.name}</strong> <span className="muted">({user.constituency || user.district || 'reporter'})</span>
          {quota ? <div className={full ? 'error' : 'muted'} style={{ margin: 0 }}>Today: {quota.used} of {quota.limit} news cards used</div> : null}
        </div>
        <div className="spacer" />
        <Button onClick={() => go('/news/new')} disabled={full}>+ New news card</Button>
      </div>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <Chips options={FILTERS} value={status} onChange={setStatus} />
        <div className="spacer" />
        <input className="search" type="search" placeholder="Search headlines" value={q} onChange={e => setQ(e.target.value)} aria-label="Search headlines" />
      </div>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {!items ? <Spinner /> : !items.length ? <p className="muted" style={{ textAlign: 'center', marginTop: 40 }}>
        {status || q ? 'No news here.' : 'No news yet. Click “New news card” to upload your first story.'}</p> : (
        <div className="cards">
          {items.map(n => (
            <a key={n._id} className="card" href={`#/news/${n._id}`}>
              {n.images?.[0] ? <img className="thumb" src={n.images[0]} alt="" loading="lazy" /> : <div className="thumb" />}
              <div style={{ minWidth: 0 }}>
                <div className="title">{n.title}</div>
                <div className="meta">{n.constituency || n.district || ''} · {new Date(n.createdAt).toLocaleDateString('en-IN')}</div>
                <Badge status={n.status} />
                {n.status === 'rejected' && n.reviewNote ? <div className="note">Editor: {n.reviewNote}</div> : null}
              </div>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
