import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { api, errMsg } from '../api';
import { SITE_BASE } from '../config';
import { STUDIO_URL, studioEmbeddable } from './Studio';
import { Button, Empty, Icon, Spinner } from '../ui';

// Same types as the layout studio's "New edition" dialog.
export const EDITION_TYPES = { state: 'State edition', district: 'District edition', constituency: 'Constituency edition', sports: 'Sports edition', business: 'Business edition' };
const PAGE = 100;

const iso = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const daysAgo = n => iso(Date.now() - n * 864e5);
const PRESETS = [['', 'Any date'], ['today', 'Today'], ['7', 'Last 7 days'], ['30', 'Last 30 days']];
const presetRange = p => (p === 'today' ? { from: daysAgo(0), to: daysAgo(0) } : p ? { from: daysAgo(Number(p) - 1), to: daysAgo(0) } : { from: '', to: '' });
const showDate = d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export default function Epapers() {
  const { can } = useAuth();
  const [type, setType] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const [items, setItems] = useState(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [busyId, setBusyId] = useState(null);

  const badRange = range.from && range.to && range.from > range.to;
  useEffect(() => {
    if (badRange) return;
    let live = true;
    setItems(null);
    api('/epapers', { params: { limit: PAGE, type, ...range } })
      .then(r => { if (live) { setItems(r.items); setTotal(r.total ?? r.items.length); setError(''); } })
      .catch(e => { if (live) setError(errMsg(e)); });
    return () => { live = false; };
  }, [type, range.from, range.to, badRange]);

  const preset = PRESETS.find(([k]) => k && JSON.stringify(presetRange(k)) === JSON.stringify(range))?.[0] ?? (range.from || range.to ? 'custom' : '');
  const filtered = type || range.from || range.to;
  const clear = () => { setType(''); setRange({ from: '', to: '' }); };

  const shareUrl = e => `${SITE_BASE}/e/${e.shareSlug}`;
  const copy = async e => {
    try { await navigator.clipboard.writeText(shareUrl(e)); setCopied(e._id); setTimeout(() => setCopied(''), 2000); }
    catch { window.prompt('Copy this link:', shareUrl(e)); }
  };
  const remove = async e => {
    const warn = e.status === 'published' ? '\n\nThis edition is published. Its share link will stop working.' : '';
    if (!window.confirm(`Delete "${e.title}" (${showDate(e.editionDate)})?\n\nThe layout is removed for good. Its news stories are kept and can be used in other editions.${warn}`)) return;
    setBusyId(e._id); setError('');
    try {
      await api(`/epapers/${e._id}`, { method: 'DELETE' });
      setItems(s => s.filter(x => x._id !== e._id)); setTotal(t => t - 1);
    } catch (err) { setError(errMsg(err)); } finally { setBusyId(null); }
  };

  return (
    <main>
      <section className="studio-card">
        <div style={{ flex: 1, minWidth: 240 }}>
          <h2>E-paper</h2>
          <p>Arrange approved news on pages, merge pages, publish and save as PDF.</p>
        </div>
        {studioEmbeddable()
          ? <a className="btn btn-accent" href="#/studio" style={{ textDecoration: 'none' }}>Open layout studio</a>
          : <a className="btn btn-accent" href={STUDIO_URL} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>Open layout studio<Icon name="external" size={16} /></a>}
      </section>

      <div className="panel">
        <div className="filters ep-filters">
          <label className="field"><span>Edition type</span>
            <select value={type} onChange={e => setType(e.target.value)}>
              <option value="">All types</option>
              {Object.entries(EDITION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="field"><span>Date</span>
            <select value={preset} onChange={e => e.target.value !== 'custom' && setRange(presetRange(e.target.value))}>
              {PRESETS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              <option value="custom" disabled>Custom range</option>
            </select>
          </label>
          <label className="field"><span>From</span>
            <input type="date" value={range.from} max={range.to || undefined} onChange={e => setRange(r => ({ ...r, from: e.target.value }))} />
          </label>
          <label className="field"><span>To</span>
            <input type="date" value={range.to} min={range.from || undefined} onChange={e => setRange(r => ({ ...r, to: e.target.value }))} />
          </label>
          <div className="field ep-clear"><span aria-hidden="true">&nbsp;</span>
            <Button kind="secondary" onClick={clear} disabled={!filtered}>Clear filters</Button>
          </div>
        </div>
        {badRange ? <p className="error" role="alert">“From” must be on or before “To”.</p> : null}
      </div>

      {error ? <p className="error" role="alert">{error}</p> : null}
      {badRange ? null : !items ? (error ? null : <Spinner />) : !items.length ? (
        filtered ? <Empty title="No editions match">Try another type or date, or <button type="button" className="link" onClick={clear}>clear the filters</button>.</Empty>
          : <Empty title="No editions yet">Open the layout studio to make one.</Empty>
      ) : (
        <>
          <p className="count-line">{total > items.length ? `Showing the latest ${items.length} of ${total} editions` : `${total} edition${total === 1 ? '' : 's'}`}</p>
          <div className="table-wrap">
            <table className="list">
              <thead><tr><th>Edition</th><th>Type</th><th>Date</th><th>Pages</th><th>Status</th><th>Share</th>{can.deleteEdition ? <th><span className="sr-only">Actions</span></th> : null}</tr></thead>
              <tbody>
                {items.map(e => (
                  <tr key={e._id}>
                    <td><strong>{e.title}</strong></td>
                    <td><span className="type-pill">{(EDITION_TYPES[e.type] || e.type || '').replace(' edition', '')}</span>{e.key ? <div className="muted" style={{ fontSize: 12 }}>{e.key}</div> : null}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{showDate(e.editionDate)}</td>
                    <td>{e.pages?.length || 0}</td>
                    <td><span className={`badge badge-${e.status === 'published' ? 'published' : 'draft'}`}>{e.status === 'published' ? 'Published' : 'Draft'}</span></td>
                    <td>{e.status === 'published' && e.shareSlug ? <div className="row" style={{ flexWrap: 'nowrap' }}>
                      <a href={shareUrl(e)} target="_blank" rel="noreferrer">Open</a>
                      <Button kind="secondary" onClick={() => copy(e)}>{copied === e._id ? 'Copied' : 'Copy link'}</Button>
                    </div> : <span className="muted">–</span>}</td>
                    {can.deleteEdition ? <td style={{ textAlign: 'right' }}>
                      <Button kind="danger" onClick={() => remove(e)} disabled={busyId === e._id}>{busyId === e._id ? 'Deleting…' : 'Delete'}</Button>
                    </td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
