import React, { useEffect, useState } from 'react';
import { api, errMsg } from '../api';
import { STATES } from '../constants';
import { Button, Empty, Icon, Spinner } from '../ui';
import { go } from '../router';
import { EDITION_TYPES } from './Epapers';

const iso = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
export const showDate = d => new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const PAPER_STATUS = { processing: ['Storing pages…', 'submitted'], ready: ['Pages ready', 'approved'], failed: ['Failed', 'rejected'] };
export const PaperBadge = ({ status }) => <span className={`badge badge-${PAPER_STATUS[status]?.[1] || 'draft'}`}>{PAPER_STATUS[status]?.[0] || status}</span>;
const MAX_PAGES = 40;
// Page images in name order, so "page-2" comes before "page-10".
const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true });
const BLANK = { publisher: '', editionName: '', editionDate: iso(Date.now()), editionType: 'district', district: '' };

// Editors and admins: upload other papers' e-papers (PDF or page images) for news extraction.
export default function Imports() {
  const [form, setForm] = useState(BLANK);
  const [files, setFiles] = useState([]);
  const [names, setNames] = useState({ publishers: [], editions: [] });
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [fileKey, setFileKey] = useState(0);   // remounts the file input to clear it

  const load = () => api('/imports', { params: { limit: 200 } })
    .then(r => { setItems(r.items); setListError(''); }).catch(e => setListError(errMsg(e)));
  useEffect(() => { load(); api('/imports/publishers').then(setNames).catch(() => {}); }, []);
  // While any upload is still storing pages, refresh the list every few seconds.
  const working = (items || []).some(p => p.status === 'processing');
  useEffect(() => { if (!working) return; const t = setInterval(load, 4000); return () => clearInterval(t); }, [working]);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const pdfs = files.filter(f => f.type === 'application/pdf');
  const fileProblem = !files.length ? '' : pdfs.length && files.length > 1 ? 'Choose one PDF, or only page images.'
    : files.length > MAX_PAGES ? `Up to ${MAX_PAGES} page images.` : '';
  const ready = form.publisher.trim() && form.editionName.trim() && form.editionDate && files.length && !fileProblem;

  const submit = async e => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true); setError('');
    const body = new FormData();
    Object.entries(form).forEach(([k, v]) => v && body.append(k, v.trim()));
    if (pdfs.length) body.append('file', pdfs[0]); else [...files].sort(byName).forEach(f => body.append('pages', f));
    try {
      const { paper } = await api('/imports', { method: 'POST', body });
      go(`/imports/${paper._id}`);
    } catch (err) { setError(errMsg(err)); setBusy(false); }
  };

  const remove = async p => {
    if (!window.confirm(`Delete ${p.publisher} – ${p.editionName} (${showDate(p.editionDate)}) and its page images?`)) return;
    try { await api(`/imports/${p._id}`, { method: 'DELETE' }); setItems(s => s.filter(x => x._id !== p._id)); }
    catch (err) { setListError(errMsg(err)); }
  };

  // Newest date first; within a date, by paper and edition (the server sorts them that way).
  const days = [];
  (items || []).forEach(p => { const d = p.editionDate.slice(0, 10); if (days[days.length - 1]?.[0] !== d) days.push([d, []]); days[days.length - 1][1].push(p); });

  return (
    <main>
      <div className="page-head">
        <div><h2>Imported e-papers</h2><p>Upload other papers' e-papers by edition and date. Their news will be extracted for review.</p></div>
      </div>

      <form className="panel" onSubmit={submit}>
        <h3>Upload an e-paper</h3>
        <p className="sub">One PDF of the whole edition, or the page images (JPG, PNG or WebP) in page order. Pages are kept at their original size.</p>
        <div className="imp-form">
          <label className="field"><span>Paper</span>
            <input value={form.publisher} onChange={set('publisher')} list="imp-publishers" maxLength={80} placeholder="e.g. Eenadu" required />
            <datalist id="imp-publishers">{names.publishers.map(n => <option key={n} value={n} />)}</datalist>
          </label>
          <label className="field"><span>Edition</span>
            <input value={form.editionName} onChange={set('editionName')} list="imp-editions" maxLength={80} placeholder="e.g. Guntur" required />
            <datalist id="imp-editions">{names.editions.map(n => <option key={n} value={n} />)}</datalist>
          </label>
          <label className="field"><span>Date on the paper</span>
            <input type="date" value={form.editionDate} max={iso(Date.now() + 864e5)} onChange={set('editionDate')} required />
          </label>
          <label className="field"><span>Edition type</span>
            <select value={form.editionType} onChange={set('editionType')}>
              {Object.entries(EDITION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="field"><span>District (optional)</span>
            <select value={form.district} onChange={set('district')}>
              <option value="">–</option>
              {Object.entries(STATES).map(([st, ds]) => <optgroup key={st} label={st}>{Object.keys(ds).map(d => <option key={d}>{d}</option>)}</optgroup>)}
            </select>
          </label>
          <label className="field imp-file"><span>File</span>
            <input key={fileKey} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple onChange={e => setFiles([...e.target.files])} />
            <small className="hint">{fileProblem ? <span className="error-text">{fileProblem}</span>
              : pdfs.length ? `${pdfs[0].name} · ${(pdfs[0].size / 1048576).toFixed(1)} MB`
              : files.length ? `${files.length} page image${files.length === 1 ? '' : 's'}, in name order` : ''}</small>
          </label>
        </div>
        {error ? <p className="error" role="alert">{error}</p> : null}
        <div className="row">
          <Button type="submit" kind="accent" disabled={!ready || busy}><Icon name="upload" size={16} />{busy ? 'Uploading…' : 'Upload'}</Button>
          {files.length || form.publisher || form.editionName ? <Button kind="secondary" onClick={() => { setForm(BLANK); setFiles([]); setFileKey(k => k + 1); setError(''); }} disabled={busy}>Clear</Button> : null}
        </div>
      </form>

      {listError ? <p className="error" role="alert">{listError}</p> : null}
      {!items ? (listError ? null : <Spinner />) : !items.length ? <Empty title="No imported e-papers yet">Upload one above to start.</Empty> : days.map(([day, papers]) => (
        <section key={day} className="imp-day">
          <h3>{showDate(day)} <span className="muted">· {papers.length} edition{papers.length === 1 ? '' : 's'}</span></h3>
          <div className="table-wrap">
            <table className="list">
              <thead><tr><th>Paper</th><th>Edition</th><th>Pages</th><th>Status</th><th>Uploaded</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {papers.map(p => {
                  const ok = p.pages.filter(x => x.status === 'ready').length;
                  return (
                    <tr key={p._id}>
                      <td><a href={`#/imports/${p._id}`}><strong>{p.publisher}</strong></a></td>
                      <td>{p.editionName}<div className="muted" style={{ fontSize: 12 }}>{(EDITION_TYPES[p.editionType] || '').replace(' edition', '')}{p.district ? ` · ${p.district}` : ''}</div></td>
                      <td>{ok === p.pages.length ? ok : `${ok} / ${p.pages.length}`}</td>
                      <td><PaperBadge status={p.status} /></td>
                      <td className="muted" style={{ fontSize: 13 }}>{p.uploadedBy?.name || ''}</td>
                      <td style={{ textAlign: 'right' }}><div className="row" style={{ flexWrap: 'nowrap', justifyContent: 'flex-end' }}>
                        <a className="btn btn-secondary" href={`#/imports/${p._id}`}>Open</a>
                        <Button kind="danger" onClick={() => remove(p)} disabled={p.status === 'processing'}>Delete</Button>
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </main>
  );
}
