import React, { useEffect, useMemo, useState } from 'react';
import { api, errMsg } from '../api';
import { Chips, Empty, Search, Spinner } from '../ui';
import { NewsCard } from './MyNews';

const DAYS = 30;
const GROUP_BY = [['reviewedAt', 'Approved date'], ['createdAt', 'Uploaded date']];

const dayKey = d => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`; };
const shortDate = d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
function dayLabel(d) {
  const today = new Date(); const yesterday = new Date(Date.now() - 864e5);
  if (dayKey(d) === dayKey(today)) return 'Today';
  if (dayKey(d) === dayKey(yesterday)) return 'Yesterday';
  return new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

// The reporter's own approved and published news from the last 30 days, grouped by day.
export default function Approved() {
  const [by, setBy] = useState('reviewedAt');
  const [q, setQ] = useState('');
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    setItems(null);
    const t = setTimeout(async () => {
      try {
        const d = await api('/news', { params: { status: 'approved,published', days: DAYS, by, limit: 300, q } });
        if (live) { setItems(d.items); setError(''); }
      } catch (e) { if (live) setError(errMsg(e)); }
    }, q ? 300 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [by, q]);

  const groups = useMemo(() => {
    const out = [];
    (items || []).forEach(n => {
      const d = n[by] || n.createdAt;
      const last = out[out.length - 1];
      if (last && last.key === dayKey(d)) last.items.push(n);
      else out.push({ key: dayKey(d), label: dayLabel(d), items: [n] });
    });
    return out;
  }, [items, by]);

  return (
    <main>
      <div className="page-head">
        <div>
          <h2>Approved news</h2>
          <p>Your approved and published news from the last {DAYS} days{items ? ` · ${items.length} ${items.length === 1 ? 'story' : 'stories'}` : ''}</p>
        </div>
      </div>
      <div className="toolbar">
        <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>Group by</span>
        <Chips options={GROUP_BY} value={by} onChange={setBy} />
        <div className="spacer" />
        <Search value={q} onChange={setQ} />
      </div>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {!items ? (error ? null : <Spinner />) : !items.length ? (
        <Empty title={q ? 'No news here' : 'Nothing approved yet'}>{q ? 'Try another search.' : `No approved news in the last ${DAYS} days.`}</Empty>
      ) : groups.map(g => (
        <section key={g.key} className="daygroup">
          <h3 className="dayhead">{g.label} <span className="count">{g.items.length}</span></h3>
          <div className="cards">
            {g.items.map(n => (
              <NewsCard key={n._id} n={n}>
                <div className="meta">{n.constituency || n.district || ''}</div>
                <div className="meta">Uploaded {shortDate(n.createdAt)}{n.reviewedAt ? ` · Approved ${shortDate(n.reviewedAt)}` : ''}</div>
              </NewsCard>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
