import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { api, errMsg } from '../api';
import { Badge, Button, Chips, Empty, Icon, Search, Spinner } from '../ui';
import { go } from '../router';

const FILTERS = [['', 'All'], ['draft', 'Drafts'], ['submitted', 'Waiting'], ['rejected', 'Sent back'], ['approved,published', 'Approved']];
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

export function NewsCard({ n, href = `#/news/${n._id}`, children }) {
  return (
    <a className="card" href={href}>
      {n.images?.[0] ? <img className="thumb" src={n.images[0]} alt="" loading="lazy" /> : <div className="thumb"><Icon name="image" size={28} /></div>}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="title">{n.title}</div>
        {children}
        <Badge status={n.status} />
        {n.status === 'rejected' && n.reviewNote ? <div className="note">Editor: {n.reviewNote}</div> : null}
      </div>
    </a>
  );
}

export default function MyNews() {
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
      <section className="hello">
        <div style={{ flex: 1, minWidth: 220 }}>
          <h2>{greeting()}, {user.name.split(' ')[0]}</h2>
          <p>{user.constituency || user.district || 'Reporter'}{user.district && user.constituency ? ` · ${user.district}` : ''}</p>
        </div>
        {quota ? (
          <div className="quota">
            <div className="lbl"><span>Today's news cards</span><span>{quota.used} / {quota.limit}</span></div>
            <div className={`bar${full ? ' full' : ''}`}><i style={{ width: `${Math.min(100, (quota.used / quota.limit) * 100)}%` }} /></div>
          </div>
        ) : null}
        <Button kind="accent" onClick={() => go('/news/new')} disabled={full} title={full ? 'Daily limit reached' : undefined}>
          <Icon name="plus" size={16} />New news card
        </Button>
      </section>
      <div className="toolbar">
        <Chips options={FILTERS} value={status} onChange={setStatus} />
        <div className="spacer" />
        <Search value={q} onChange={setQ} />
      </div>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {!items ? (error ? null : <Spinner />) : !items.length ? (
        <Empty title={status || q ? 'No news here' : 'No news yet'}>{status || q ? 'Try another filter or search.' : 'Click “New news card” to upload your first story.'}</Empty>
      ) : (
        <div className="cards">
          {items.map(n => (
            <NewsCard key={n._id} n={n}>
              <div className="meta">{n.constituency || n.district || ''} · {new Date(n.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            </NewsCard>
          ))}
        </div>
      )}
    </main>
  );
}
