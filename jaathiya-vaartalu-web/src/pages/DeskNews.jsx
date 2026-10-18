import React, { useEffect, useState } from 'react';
import { api, errMsg } from '../api';
import { SECTIONS } from '../constants';
import PlacePicker from '../PlacePicker';
import { Button, Chips, Empty, Icon, Search, Spinner } from '../ui';
import { go } from '../router';
import { NewsCard } from './MyNews';

const TABS = [['review', 'Review'], ['approved', 'Ready to place'], ['all', 'All news'], ['mine', 'My news']];
const TAB_PARAMS = { review: { status: 'submitted' }, approved: { status: 'approved' }, all: {}, mine: { author: 'me' } };
const EMPTY = { review: ['Nothing waiting for review', 'New stories from reporters show up here.'], approved: ['No approved news yet', 'Approve stories in Review to place them in the e-paper.'] };
const PAGE = 60;

// Editors and admins: every reporter's news, filtered by status, place and section.
export default function DeskNews() {
  const [tab, setTab] = useState(() => { try { return sessionStorage.getItem('jv_desk_tab') || 'review'; } catch { return 'review'; } });
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

  const href = n => (tab === 'mine' ? `#/news/${n._id}` : `#/review/${n._id}`);
  const [emptyTitle, emptyText] = EMPTY[tab] || ['No news here', 'Try another filter or search.'];
  return (
    <main>
      <div className="page-head">
        <div><h2>News</h2><p>Review reporters' stories and get them ready for the e-paper.</p></div>
        <div className="spacer" />
        <Button kind="accent" onClick={() => go('/news/new')}><Icon name="plus" size={16} />New news card</Button>
      </div>
      <div className="toolbar">
        <Chips options={TABS} value={tab} onChange={setTab} />
        <div className="spacer" />
        <Search value={q} onChange={setQ} />
      </div>
      <div className="panel">
        <div className="filters">
          <PlacePicker value={place} onChange={setPlace} allowAll>
            <label className="field"><span>Section</span>
              <select value={section} onChange={e => setSection(e.target.value)}>
                <option value="">అన్నీ (All)</option>
                {Object.entries(SECTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </PlacePicker>
        </div>
      </div>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {!items ? (error ? null : <Spinner />) : !items.length ? <Empty title={emptyTitle}>{emptyText}</Empty> : (
        <>
          <p className="count-line">Showing {items.length} of {total}</p>
          <div className="cards">
            {items.map(n => (
              <NewsCard key={n._id} n={n} href={href(n)}>
                <div className="meta">{n.constituency || n.district || ''}{n.author?.name ? ` · ${n.author.name}` : ''} · {new Date(n.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
              </NewsCard>
            ))}
          </div>
          {items.length < total ? <div className="row" style={{ justifyContent: 'center', marginTop: 20 }}>
            <Button kind="secondary" onClick={() => setPage(p => p + 1)}>Load more</Button></div> : null}
        </>
      )}
    </main>
  );
}
