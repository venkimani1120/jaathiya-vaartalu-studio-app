import React, { useEffect, useState } from 'react';
import { api, errMsg } from '../api';
import { Badge, Button, Icon, Spinner } from '../ui';
import { go } from '../router';
import { EDITION_TYPES } from './Epapers';
import { PaperBadge, showDate } from './Imports';

// Adds a Cloudinary transformation after the ones already in the URL (e.g. the PDF density). Local files: unchanged.
const cld = (url, t) => (!url.includes('/image/upload/') ? url
  : /\/v\d+\//.test(url) ? url.replace(/\/(v\d+\/)/, `/${t}/$1`) : url.replace('/image/upload/', `/image/upload/${t}/`));
const thumb = url => cld(url, 'w_360,c_limit,f_auto,q_auto');
const EXTRACT = { pending: 'Waiting to be read', running: 'Reading…', done: 'Read', failed: 'Could not read' };
const pct = (v, of) => `${(v / of) * 100}%`;

// One imported e-paper: its pages at their original pixels, and the news read from each page.
export default function ImportPaper({ id }) {
  const [paper, setPaper] = useState(null);
  const [news, setNews] = useState([]);
  const [extraction, setExtraction] = useState(null);   // { enabled, model }
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null);      // page number shown large
  const [actual, setActual] = useState(false); // false = fit to width, true = 1 image pixel per screen pixel
  const [reload, setReload] = useState(0);

  useEffect(() => { api('/imports/status').then(r => setExtraction(r.extraction)).catch(() => {}); }, []);
  useEffect(() => {
    let live = true, timer;
    const load = () => Promise.all([api(`/imports/${id}`), api('/news', { params: { paper: id, limit: 300 } })]).then(([{ paper: p }, n]) => {
      if (!live) return;
      setPaper(p); setNews(n.items); setError('');
      const reading = p.pages.some(x => x.status === 'ready' && x.extract !== 'done' && x.extract !== 'failed');
      if (p.status === 'processing' || reading) timer = setTimeout(load, 5000);
    }).catch(e => live && setError(errMsg(e)));
    load();
    return () => { live = false; clearTimeout(timer); };
  }, [id, reload]);

  const remove = async () => {
    if (!window.confirm(`Delete ${paper.publisher} – ${paper.editionName}, its page images and its news that is not approved yet?`)) return;
    try { await api(`/imports/${id}`, { method: 'DELETE' }); go('/imports'); } catch (e) { setError(errMsg(e)); }
  };
  const readAgain = async no => {
    const what = no ? `page ${no}` : 'every page';
    if (!window.confirm(`Read ${what} again?\n\nNews from ${no ? 'this page' : 'these pages'} that is waiting for review or was sent back is replaced. Approved news is kept.`)) return;
    setBusy(true); setError('');
    try { await api(`/imports/${id}/extract`, { method: 'POST', params: no ? { page: no } : undefined }); setReload(r => r + 1); }
    catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };

  const recrop = async () => {
    setBusy(true); setError('');
    try { const r = await api(`/imports/${id}/recrop`, { method: 'POST' }); setReload(x => x + 1); window.alert(`Photo crops fitted again on ${r.updated} news card(s).`); }
    catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };

  const back = <a className="back" href="#/imports"><Icon name="back" size={16} />Imported e-papers</a>;
  if (!paper) return <main>{back}{error ? <p className="error">{error}</p> : <Spinner />}</main>;
  const ready = paper.pages.filter(p => p.status === 'ready');
  const read = ready.filter(p => p.extract === 'done').length;
  const page = open && paper.pages.find(p => p.no === open);
  const step = d => { const i = ready.findIndex(p => p.no === open) + d; if (ready[i]) setOpen(ready[i].no); };
  const onPage = no => news.filter(n => n.sourceRef?.page === no);
  const waiting = news.filter(n => n.status === 'submitted').length;

  return (
    <main>
      {back}
      <div className="page-head">
        <div>
          <h2>{paper.publisher} – {paper.editionName}</h2>
          <p>{showDate(paper.editionDate)} · {(EDITION_TYPES[paper.editionType] || '').replace(' edition', '')}{paper.district ? ` · ${paper.district}` : ''}
            {' · '}{paper.fileKind === 'pdf' ? `PDF at ${paper.dpi} dpi` : 'page images'}{paper.uploadedBy?.name ? ` · uploaded by ${paper.uploadedBy.name}` : ''}</p>
        </div>
        <div className="spacer" />
        <PaperBadge status={paper.status} />
        {news.some(n => n.sourceRef?.photos?.length) ? <Button kind="secondary" onClick={recrop} disabled={busy}>{busy ? 'Working…' : 'Fix photo crops'}</Button> : null}
        {extraction?.enabled && ready.length ? <Button kind="secondary" onClick={() => readAgain(null)} disabled={busy}>Read all pages again</Button> : null}
        <Button kind="danger" onClick={remove} disabled={paper.status === 'processing'}>Delete</Button>
      </div>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {paper.status === 'processing' ? <p className="notice">Storing pages: {paper.pages.filter(p => p.status !== 'pending').length} of {paper.pages.length} done. You can leave this page; it carries on.</p> : null}
      {paper.error ? <p className="error">{paper.error}</p> : null}
      {extraction && !extraction.enabled ? <p className="notice">News extraction is off. Set <code>GEMINI_API_KEY</code> on the server (a free key from Google AI Studio) and restart it; these pages will then be read.</p> : null}

      <div className="imp-summary">
        <span><b>{ready.length}</b> of {paper.pages.length} pages stored</span>
        {extraction?.enabled ? <span><b>{read}</b> of {ready.length} read</span> : null}
        <span><b>{news.length}</b> news found</span>
        {waiting ? <a href="#/" onClick={() => { try { sessionStorage.setItem('jv_desk_tab', 'review'); sessionStorage.setItem('jv_desk_source', 'epaper'); } catch {} }}><b>{waiting}</b> waiting for review</a> : null}
      </div>

      <div className="imp-pages">
        {paper.pages.map(p => (
          <figure key={p.no} className={`imp-page imp-${p.status}`}>
            {p.status === 'ready'
              ? <button type="button" onClick={() => { setOpen(p.no); setActual(false); }} aria-label={`Open page ${p.no}`}><img src={thumb(p.imageUrl)} alt="" loading="lazy" /></button>
              : <div className="imp-ph">{p.status === 'pending' ? <Spinner /> : <span>{p.error || 'Failed'}</span>}</div>}
            <figcaption>Page {p.no}{p.width ? <span className="muted"> · {p.width}×{p.height}</span> : null}
              {p.status === 'ready' && extraction?.enabled ? <span className={`imp-x imp-x-${p.extract || 'pending'}`}>
                {p.extract === 'done' ? `${p.articles || 0} news${p.repeats ? ` · ${p.repeats} repeats skipped` : ''}` : EXTRACT[p.extract || 'pending']}</span> : null}
              {p.extractError && p.extract !== 'done' ? <span className="imp-x-err" title={p.extractError}>{p.extractError}</span> : null}
            </figcaption>
          </figure>
        ))}
      </div>

      {news.length ? <section className="imp-news">
        <h3>News found</h3>
        {ready.filter(p => onPage(p.no).length).map(p => (
          <div key={p.no} className="imp-news-page">
            <div className="row"><b>Page {p.no}</b><div className="spacer" />
              <button type="button" className="link" onClick={() => { setOpen(p.no); setActual(false); }}>Show on page</button>
              {extraction?.enabled ? <button type="button" className="link" onClick={() => readAgain(p.no)} disabled={busy || p.extract === 'running'}>Read again</button> : null}
            </div>
            <ul>{onPage(p.no).map(n => <li key={n._id}><a href={`#/review/${n._id}`}>{n.title}</a> <Badge status={n.status} /></li>)}</ul>
          </div>
        ))}
      </section> : null}

      {page ? (
        <div className="imp-viewer" role="dialog" aria-modal="true" aria-label={`Page ${page.no}`} onKeyDown={e => { if (e.key === 'Escape') setOpen(null); if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1); }}>
          <div className="imp-viewer-bar">
            <b>Page {page.no}</b><span className="muted">{page.width}×{page.height} px · {onPage(page.no).length} news</span>
            <div className="spacer" />
            <Button kind="secondary" onClick={() => step(-1)}>Previous</Button>
            <Button kind="secondary" onClick={() => step(1)}>Next</Button>
            <Button kind="secondary" onClick={() => setActual(a => !a)}>{actual ? 'Fit to width' : 'Actual pixels'}</Button>
            <a className="btn btn-secondary" href={page.imageUrl} target="_blank" rel="noreferrer">Original<Icon name="external" size={14} /></a>
            <Button autoFocus onClick={() => setOpen(null)}>Close</Button>
          </div>
          <div className="imp-viewer-body">
            <div className="imp-sheet" style={actual ? { width: page.width / (window.devicePixelRatio || 1) } : { maxWidth: page.width }}>
              <img src={page.imageUrl} alt={`Page ${page.no}`} width={page.width} height={page.height} />
              {onPage(page.no).filter(n => n.sourceRef?.bbox?.w).map(n => {
                const b = n.sourceRef.bbox;
                return <a key={n._id} href={`#/review/${n._id}`} className={`imp-box imp-box-${n.status}`} title={n.title}
                  style={{ left: pct(b.x, page.width), top: pct(b.y, page.height), width: pct(b.w, page.width), height: pct(b.h, page.height) }}>
                  <span>{n.title}</span></a>;
              })}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
