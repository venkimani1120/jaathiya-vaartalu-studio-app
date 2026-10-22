import React, { useEffect, useState } from 'react';
import { api, errMsg } from '../api';
import { Button, Icon, Spinner } from '../ui';
import { go } from '../router';
import { EDITION_TYPES } from './Epapers';
import { PaperBadge, showDate } from './Imports';

// Smaller copy for the page grid. Cloudinary makes it on the fly; local files are shown as they are.
const thumb = url => (url.includes('/image/upload/') ? url.replace('/image/upload/', '/image/upload/w_360,c_limit,f_auto,q_auto/') : url);

// One imported e-paper: its pages, and each page at its original pixels.
export default function ImportPaper({ id }) {
  const [paper, setPaper] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);      // page number shown large
  const [actual, setActual] = useState(false); // false = fit to width, true = 1 image pixel per screen pixel

  useEffect(() => {
    let live = true, timer;
    const load = () => api(`/imports/${id}`).then(({ paper: p }) => {
      if (!live) return;
      setPaper(p); setError('');
      if (p.status === 'processing') timer = setTimeout(load, 3000);
    }).catch(e => live && setError(errMsg(e)));
    load();
    return () => { live = false; clearTimeout(timer); };
  }, [id]);

  const remove = async () => {
    if (!window.confirm(`Delete ${paper.publisher} – ${paper.editionName} and its page images?`)) return;
    try { await api(`/imports/${id}`, { method: 'DELETE' }); go('/imports'); } catch (e) { setError(errMsg(e)); }
  };

  const back = <a className="back" href="#/imports"><Icon name="back" size={16} />Imported e-papers</a>;
  if (!paper) return <main>{back}{error ? <p className="error">{error}</p> : <Spinner />}</main>;
  const ok = paper.pages.filter(p => p.status === 'ready').length;
  const page = open && paper.pages.find(p => p.no === open);
  const step = d => { const ready = paper.pages.filter(p => p.status === 'ready'); const i = ready.findIndex(p => p.no === open) + d; if (ready[i]) setOpen(ready[i].no); };

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
        <Button kind="danger" onClick={remove} disabled={paper.status === 'processing'}>Delete</Button>
      </div>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {paper.status === 'processing' ? <p className="notice">Storing pages: {paper.pages.filter(p => p.status !== 'pending').length} of {paper.pages.length} done. You can leave this page; it carries on.</p> : null}
      {paper.error ? <p className="error">{paper.error}</p> : null}
      <p className="count-line">{ok} of {paper.pages.length} pages ready. News extraction from these pages comes in the next update.</p>

      <div className="imp-pages">
        {paper.pages.map(p => (
          <figure key={p.no} className={`imp-page imp-${p.status}`}>
            {p.status === 'ready'
              ? <button type="button" onClick={() => { setOpen(p.no); setActual(false); }} aria-label={`Open page ${p.no}`}><img src={thumb(p.imageUrl)} alt="" loading="lazy" /></button>
              : <div className="imp-ph">{p.status === 'pending' ? <Spinner /> : <span>{p.error || 'Failed'}</span>}</div>}
            <figcaption>Page {p.no}{p.width ? <span className="muted"> · {p.width}×{p.height}</span> : null}</figcaption>
          </figure>
        ))}
      </div>

      {page ? (
        <div className="imp-viewer" role="dialog" aria-modal="true" aria-label={`Page ${page.no}`} onKeyDown={e => { if (e.key === 'Escape') setOpen(null); if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1); }}>
          <div className="imp-viewer-bar">
            <b>Page {page.no}</b><span className="muted">{page.width}×{page.height} px</span>
            <div className="spacer" />
            <Button kind="secondary" onClick={() => step(-1)}>Previous</Button>
            <Button kind="secondary" onClick={() => step(1)}>Next</Button>
            <Button kind="secondary" onClick={() => setActual(a => !a)}>{actual ? 'Fit to width' : 'Actual pixels'}</Button>
            <a className="btn btn-secondary" href={page.imageUrl} target="_blank" rel="noreferrer">Original<Icon name="external" size={14} /></a>
            <Button autoFocus onClick={() => setOpen(null)}>Close</Button>
          </div>
          <div className="imp-viewer-body">
            <img src={page.imageUrl} alt={`Page ${page.no}`} width={page.width} height={page.height}
              style={actual ? { width: page.width / (window.devicePixelRatio || 1), maxWidth: 'none' } : undefined} />
          </div>
        </div>
      ) : null}
    </main>
  );
}
