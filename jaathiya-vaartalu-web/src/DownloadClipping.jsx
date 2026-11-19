import React, { useEffect, useState } from 'react';
import { DEFAULT_HEADER, downloadClipping, renderClipping } from './clipping';
import { iso } from './dates';
import { Button, Chips, Field, Icon } from './ui';

const FORMATS = [['pdf', 'PDF'], ['png', 'PNG image']];
export const CAN_DOWNLOAD = ['approved', 'published'];

// "Download" beside "Edit" on approved news: asks for the e-paper header title and date (both needed,
// prefilled), shows a preview, and saves the story as a PDF or PNG clipping.
export function DownloadButton({ news, disabled }) {
  const [open, setOpen] = useState(false);
  if (!news || !CAN_DOWNLOAD.includes(news.status)) return null;
  return <>
    <Button kind="secondary" onClick={() => setOpen(true)} disabled={disabled}><Icon name="download" size={16} />Download</Button>
    {open ? <DownloadDialog news={news} onClose={() => setOpen(false)} /> : null}
  </>;
}

function DownloadDialog({ news, onClose }) {
  const [title, setTitle] = useState(DEFAULT_HEADER);
  const [date, setDate] = useState(() => iso(new Date()));
  const [format, setFormat] = useState('pdf');
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const ok = title.trim() && /^\d{4}-\d{2}-\d{2}$/.test(date);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  // Redraw the preview shortly after the title or date stops changing.
  useEffect(() => {
    if (!ok) return;
    let live = true;
    const t = setTimeout(async () => {
      try {
        const { canvas, photoMissing } = await renderClipping(news, { title: title.trim(), date });
        if (!live) return;
        setPreview(canvas.toDataURL('image/jpeg', 0.8));
        setNotice(photoMissing ? 'The photo could not be loaded, so the clipping is made without it.' : '');
      } catch (e) { if (live) setError(e.message); }
    }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [news, title, date, ok]);

  const save = async e => {
    e.preventDefault();
    if (!ok) return setError('Enter the header title and the date.');
    setBusy(true); setError('');
    try { await downloadClipping(news, { title: title.trim(), date, format }); onClose(); }
    catch (err) { setError(err.message || 'Could not make the file.'); setBusy(false); }
  };

  return (
    <div className="crop-modal" role="dialog" aria-modal="true" aria-label="Download news" onClick={e => e.target === e.currentTarget && onClose()}>
      <form className="crop-sheet dl-sheet" onSubmit={save}>
        <div className="dl-form">
          <h3 style={{ margin: 0 }}>Download news</h3>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>Saved as an e-paper clipping with this header and date.</p>
          <Field label="E-paper header title" value={title} onChange={e => setTitle(e.target.value)} required maxLength={60} autoFocus />
          <Field label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
          <Chips label="Format" options={FORMATS} value={format} onChange={setFormat} />
          {notice ? <p className="notice" style={{ margin: 0 }}>{notice}</p> : null}
          {error ? <p className="error" role="alert" style={{ margin: 0 }}>{error}</p> : null}
          <div className="row">
            <Button type="submit" disabled={!ok || busy}><Icon name="download" size={16} />{busy ? 'Making…' : `Download ${format.toUpperCase()}`}</Button>
            <Button kind="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          </div>
        </div>
        <div className="dl-preview" aria-label="Preview">
          {ok && preview ? <img src={preview} alt="Preview of the clipping" /> : <p className="muted">{ok ? 'Preparing preview…' : 'Enter the header title and date to see the preview.'}</p>}
        </div>
      </form>
    </div>
  );
}
