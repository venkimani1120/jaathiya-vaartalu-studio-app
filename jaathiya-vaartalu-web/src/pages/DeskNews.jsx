import React, { useEffect, useState } from 'react';
import { api, errMsg } from '../api';
import { SECTIONS, SOURCES } from '../constants';
import PlacePicker from '../PlacePicker';
import { Button, Chips, Empty, Icon, Search, SourceBadge, Spinner } from '../ui';
import { go } from '../router';
import { NewsCard } from './MyNews';

const TABS = [['review', 'Review'], ['approved', 'Ready to place'], ['all', 'All news'], ['mine', 'My news']];
const TAB_PARAMS = { review: { status: 'submitted' }, approved: { status: 'approved' }, all: {}, mine: { author: 'me' } };
const EMPTY = { review: ['Nothing waiting for review', 'New stories from reporters show up here.'], approved: ['No approved news yet', 'Approve stories in Review to place them in the e-paper.'] };
const PAGE = 60;

const remembered = (key, fallback) => { try { return sessionStorage.getItem(key) ?? fallback; } catch { return fallback; } };

// Editors and admins: all news, filtered by status, source (reporter / editor / admin / e-paper), place and section.
export default function DeskNews() {
  const [tab, setTab] = useState(() => remembered('jv_desk_tab', 'review'));
  const [source, setSource] = useState(() => remembered('jv_desk_source', ''));
  const [counts, setCounts] = useState(null);
  const [place, setPlace] = useState({ state: '', district: '', constituency: '' });
  const [section, setSection] = useState('');
  const [q, setQ] = useState('');
  const [items, setItems] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState(() => new Set());   // ids ticked for deleting
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => { try { sessionStorage.setItem('jv_desk_tab', tab); sessionStorage.setItem('jv_desk_source', source); } catch {} }, [tab, source]);
  useEffect(() => { setPage(1); setPicked(new Set()); }, [tab, source, place, section, q]);

  // Per-source totals for the chips, under the same tab, place, section and search.
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => api('/news/counts', { params: { ...TAB_PARAMS[tab], ...place, section, q } })
      .then(r => live && setCounts(r)).catch(() => live && setCounts(null)), q ? 300 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [tab, place, section, q]);

  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      try {
        const data = await api('/news', { params: { limit: PAGE, page, ...TAB_PARAMS[tab], source, ...place, section, q } });
        if (!live) return;
        setItems(s => (page === 1 ? data.items : [...(s || []), ...data.items])); setTotal(data.total); setError('');
      } catch (e) { if (live) setError(errMsg(e)); }
    }, q ? 300 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [tab, source, place, section, q, page]);

  // News in a published e-paper can't be deleted, so it has no tick box.
  const deletable = (items || []).filter(n => n.status !== 'published');
  const allPicked = deletable.length > 0 && deletable.every(n => picked.has(n._id));
  const toggle = id => setPicked(s => { const t = new Set(s); t.has(id) ? t.delete(id) : t.add(id); return t; });
  const toggleAll = () => setPicked(allPicked ? new Set() : new Set(deletable.map(n => n._id)));
  const removePicked = async () => {
    const ids = [...picked];
    if (!window.confirm(`Delete ${ids.length} news card${ids.length > 1 ? 's' : ''}?\n\nThey are removed from the database and from any draft e-paper they are placed in. This cannot be undone.`)) return;
    setDeleting(true); setError(''); setNotice('');
    try {
      let deleted = 0, published = 0;
      for (let i = 0; i < ids.length; i += 200) {
        const r = await api('/news/bulk-delete', { method: 'POST', body: { ids: ids.slice(i, i + 200) } });
        deleted += r.deleted; published += r.published;
      }
      const gone = new Set(ids);
      setItems(s => s.filter(n => !gone.has(n._id) || n.status === 'published'));
      setTotal(t => t - deleted); setPicked(new Set());
      setNotice(`Deleted ${deleted} news card${deleted === 1 ? '' : 's'}.${published ? ` ${published} kept: in a published e-paper.` : ''}`);
      api('/news/counts', { params: { ...TAB_PARAMS[tab], ...place, section, q } }).then(setCounts).catch(() => {});
    } catch (e) { setError(errMsg(e)); }
    setDeleting(false);
  };

  const countOf = k => (counts ? <span className="n">{k ? counts.counts[k] : counts.total}</span> : null);
  const sourceChips = [['', <>All sources{countOf('')}</>], ...Object.entries(SOURCES).map(([k, s]) => [k, <>{s.label}{countOf(k)}</>])];
  const href = n => (tab === 'mine' ? `#/news/${n._id}` : `#/review/${n._id}`);
  const [emptyTitle, emptyText] = EMPTY[tab] || ['No news here', 'Try another filter or search.'];
  return (
    <main>
      <div className="page-head">
        <div><h2>News</h2><p>Review stories from reporters, the desk and imported e-papers, and get them ready for the e-paper.</p></div>
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
        <Chips label="Source" options={sourceChips} value={source} onChange={setSource} />
      </div>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {!items ? (error ? null : <Spinner />) : !items.length ? <Empty title={emptyTitle}>{emptyText}</Empty> : (
        <>
          <div className="select-bar">
            <label className="check"><input type="checkbox" checked={allPicked} onChange={toggleAll} disabled={!deletable.length || deleting} />
              Select all shown</label>
            <span className="count-line">{picked.size ? `${picked.size} selected · ` : ''}Showing {items.length} of {total}</span>
            <div className="spacer" />
            {picked.size ? <>
              <Button kind="secondary" onClick={() => setPicked(new Set())} disabled={deleting}>Clear</Button>
              <Button kind="danger" onClick={removePicked} disabled={deleting}><Icon name="trash" size={16} />{deleting ? 'Deleting…' : `Delete ${picked.size}`}</Button>
            </> : null}
          </div>
          {notice ? <p className="notice" role="status">{notice}</p> : null}
          <div className="cards">
            {items.map(n => (
              <div key={n._id} className={`pickable${picked.has(n._id) ? ' picked' : ''}`}>
                {n.status !== 'published' ? <input type="checkbox" className="pick" checked={picked.has(n._id)} onChange={() => toggle(n._id)}
                  disabled={deleting} aria-label={`Select ${n.title}`} /> : null}
                <NewsCard n={n} href={href(n)}>
                  <div className="meta"><SourceBadge source={n.source} />{n.constituency || n.district || ''}{n.sourceRef?.publisher ? ` · ${n.sourceRef.publisher} ${n.sourceRef.editionName}, p${n.sourceRef.page}` : n.author?.name ? ` · ${n.author.name}` : ''} · {new Date(n.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                </NewsCard>
              </div>
            ))}
          </div>
          {items.length < total ? <div className="row" style={{ justifyContent: 'center', marginTop: 20 }}>
            <Button kind="secondary" onClick={() => setPage(p => p + 1)}>Load more</Button></div> : null}
        </>
      )}
    </main>
  );
}
