import React, { useEffect, useState } from 'react';
import { api, errMsg } from '../api';
import { SECTIONS } from '../constants';
import PlacePicker from '../PlacePicker';
import { Badge, Button, Chips, Spinner } from '../ui';
import { go } from '../router';

const TABS = [['review', 'Review'], ['approved', 'Ready to place'], ['all', 'All news'], ['mine', 'My news']];
const TAB_PARAMS = { review: { status: 'submitted' }, approved: { status: 'approved' }, all: {}, mine: { author: 'me' } };
const PAGE = 60;

export default function Home() {
  const [tab, setTab] = useState(() => sessionStorage.getItem('jv_desk_tab') || 'review');
  const [place, setPlace] = useState({ state: '', district: '', constituency: '' });
  const [section, setSection] = useState('');
  const [q, setQ] = useState('');
  const [items, setItems] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => { try { sessionStorage.setItem('jv_desk_tab', tab); } catch {} }, [tab]);
  useEffect(() => { setPage(1); }, [tab, place, section, q]);

  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      try {
        const data = await api('/news', { params: { limit: PAGE, page, ...TAB_PARAMS[tab], ...place, section, q } });
        if (!live) return;
        setItems(s => (page === 1 ? data.items : [...(s || []), ...data.items])); setTotal(data.total); setError('');
      } catch (e) { if (live) setError(errMsg(e)); }
    }, q ? 300 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [tab, place, section, q, page]);

  const open = n => go(tab === 'mine' ? `/news/${n._id}` : `/review/${n._id}`);
  return (
    <main>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <Chips options={TABS} value={tab} onChange={setTab} />
        <div className="spacer" />
        <Button onClick={() => go('/news/new')}>+ New news card</Button>
      </div>
      <div className="panel">
        <PlacePicker value={place} onChange={setPlace} allowAll />
        <div className="grid3">
          <label className="field"><span>Section</span>
            <select value={section} onChange={e => setSection(e.target.value)}>
              <option value="">అన్నీ (All)</option>
              {Object.entries(SECTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="field"><span>Search headlines</span>
            <input type="search" value={q} onChange={e => setQ(e.target.value)} />
          </label>
        </div>
      </div>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {!items ? <Spinner /> : !items.length ? <p className="muted" style={{ textAlign: 'center', marginTop: 40 }}>
        {tab === 'review' ? 'Nothing waiting for review.' : tab === 'approved' ? 'No approved news yet.' : 'No news here.'}</p> : (
        <>
          <p className="muted">Showing {items.length} of {total}</p>
          <div className="cards">
            {items.map(n => (
              <a key={n._id} className="card" href={tab === 'mine' ? `#/news/${n._id}` : `#/review/${n._id}`} onClick={e => { e.preventDefault(); open(n); }}>
                {n.images?.[0] ? <img className="thumb" src={n.images[0]} alt="" loading="lazy" /> : <div className="thumb" />}
                <div style={{ minWidth: 0 }}>
                  <div className="title">{n.title}</div>
                  <div className="meta">{n.constituency || n.district || ''}{n.author?.name ? ` · ${n.author.name}` : ''} · {new Date(n.createdAt).toLocaleDateString('en-IN')}</div>
                  <Badge status={n.status} />
                  {n.status === 'rejected' && n.reviewNote ? <div className="note">Note: {n.reviewNote}</div> : null}
                </div>
              </a>
            ))}
          </div>
          {items.length < total ? <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
            <Button kind="secondary" onClick={() => setPage(p => p + 1)}>Load more</Button></div> : null}
        </>
      )}
    </main>
  );
}
