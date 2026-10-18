import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth';
import { api, errMsg, uploadImages } from '../api';
import { SECTIONS, MAX_IMAGES, MAX_IMAGE_MB, stateOf } from '../constants';
import PlacePicker from '../PlacePicker';
import { Badge, Button, Chips, Field, Icon, Spinner } from '../ui';
import { go } from '../router';

const EDITABLE_BY_REPORTER = ['draft', 'submitted', 'rejected'];

export default function NewsEditor({ id }) {
  const { user, can } = useAuth();
  const [f, setF] = useState({ title: '', highlights: '', body: '', section: 'constituency',
    state: user.state || stateOf(user.district) || 'ఆంధ్రప్రదేశ్', district: user.district || '', constituency: user.constituency || '', dateline: '' });
  const [images, setImages] = useState([]);   // { url, file? } — file is set for photos not uploaded yet
  const [status, setStatus] = useState('draft');
  const [ownerId, setOwnerId] = useState(user.id);
  const [reviewNote, setReviewNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState('');
  const gallery = useRef(null);
  const camera = useRef(null);

  useEffect(() => { if (id) (async () => {
    try {
      const { news: n } = await api(`/news/${id}`);
      setF({ title: n.title, highlights: (n.highlights || []).join('\n'), body: n.body, section: n.section,
        state: n.state || stateOf(n.district) || 'ఆంధ్రప్రదేశ్', district: n.district || '', constituency: n.constituency || '', dateline: n.dateline || '' });
      setImages((n.images || []).map(url => ({ url })));
      setStatus(n.status); setOwnerId(n.author?._id); setReviewNote(n.reviewNote || '');
    } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  })(); }, [id]);

  // Free the local previews when leaving the page.
  const imagesRef = useRef(images);
  imagesRef.current = images;
  useEffect(() => () => imagesRef.current.forEach(i => i.file && URL.revokeObjectURL(i.url)), []);

  // Editors and admins can change any card; reporters only their own before approval.
  // Only admins can delete other people's cards. The server checks all of this too.
  const own = ownerId === user.id && EDITABLE_BY_REPORTER.includes(status);
  const locked = !can.desk && !own;
  const canDelete = can.deleteAny || own;
  const home = can.desk ? 'News' : 'My news';
  const set = k => e => setF(s => ({ ...s, [k]: e.target.value }));

  const addFiles = list => {
    setError('');
    const room = MAX_IMAGES - images.length;
    const files = [...list].filter(file => file.type.startsWith('image/'));
    const big = files.filter(file => file.size > MAX_IMAGE_MB * 1024 * 1024);
    if (big.length) setError(`Each photo must be under ${MAX_IMAGE_MB} MB. Skipped: ${big.map(b => b.name).join(', ')}`);
    const ok = files.filter(file => !big.includes(file));
    if (ok.length > room) setError(`A news card can have up to ${MAX_IMAGES} photos.`);
    setImages(s => [...s, ...ok.slice(0, room).map(file => ({ url: URL.createObjectURL(file), file }))]);
  };
  const removeImage = i => setImages(s => {
    if (s[i].file) URL.revokeObjectURL(s[i].url);
    return s.filter((_, j) => j !== i);
  });

  const save = async submit => {
    setError('');
    if (!f.title.trim() || !f.body.trim()) return setError('Add a headline and the news text.');
    if (!f.district) return setError('Choose the district for this news.');
    setBusy(true);
    try {
      const uploaded = await uploadImages(images.filter(i => i.file).map(i => i.file));
      let k = 0;
      const urls = images.map(i => (i.file ? uploaded[k++] : i.url));
      const body = { ...f, highlights: f.highlights.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 5),
        dateline: f.dateline || f.constituency || f.district, images: urls, submit };
      if (id) await api(`/news/${id}`, { method: 'PATCH', body }); else await api('/news', { method: 'POST', body });
      go('/');
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!window.confirm('Delete this news card? This cannot be undone.')) return;
    setBusy(true);
    try { await api(`/news/${id}`, { method: 'DELETE' }); go('/'); } catch (e) { setError(errMsg(e)); setBusy(false); }
  };

  if (loading) return <Spinner />;
  return (
    <main className="narrow">
      <a className="back" href="#/"><Icon name="back" size={16} />{home}</a>
      <div className="page-head">
        <h2>{id ? 'Edit news' : 'New news card'}</h2>
        {id ? <Badge status={status} /> : null}
      </div>
      <div className="panel">
        {locked ? <p className="notice">This news is {status}. Only an editor can change it now.</p> : null}
        {can.desk && status === 'published' ? <p className="notice">This news is already in a published edition.</p> : null}
        {status === 'rejected' && reviewNote ? <p className="notice">{can.desk ? 'Sent back with note' : "Editor's note"}: {reviewNote}</p> : null}
        <Field label="Headline" value={f.title} onChange={set('title')} disabled={locked} />
        <Field label="Highlights (one per line, up to 5)" multiline value={f.highlights} onChange={set('highlights')} disabled={locked} style={{ minHeight: 80 }} />

        <div className="field">
          <span>Photos ({images.length}/{MAX_IMAGES})</span>
          <div className="photos"
            onDragOver={e => { if (!locked) e.preventDefault(); }}
            onDrop={e => { if (!locked) { e.preventDefault(); addFiles(e.dataTransfer.files); } }}>
            {images.map((im, i) => (
              <div className="photo" key={im.url}>
                <img src={im.url} alt={`Photo ${i + 1}`} />
                {!locked ? <button type="button" onClick={() => removeImage(i)} aria-label={`Remove photo ${i + 1}`}>✕</button> : null}
              </div>
            ))}
            {!images.length ? <p className="muted" style={{ margin: 0 }}>{locked ? 'No photos.' : 'Drop photos here, or use the buttons below.'}</p> : null}
          </div>
          {!locked ? <div className="row">
            <Button kind="secondary" onClick={() => gallery.current.click()} disabled={images.length >= MAX_IMAGES}><Icon name="image" size={16} />Add photos</Button>
            <Button kind="secondary" onClick={() => camera.current.click()} disabled={images.length >= MAX_IMAGES}><Icon name="camera" size={16} />Camera</Button>
            <input ref={gallery} className="hidden-input" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple
              onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
            <input ref={camera} className="hidden-input" type="file" accept="image/*" capture="environment"
              onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
          </div> : null}
        </div>

        <Field label="News text" multiline value={f.body} onChange={set('body')} disabled={locked} style={{ minHeight: 260 }} />
        <Chips label="Section" options={Object.entries(SECTIONS)} value={f.section} onChange={v => setF(s => ({ ...s, section: v }))} disabled={locked} />
        <PlacePicker value={f} disabled={locked} onChange={p => setF(s => ({ ...s, ...p }))} />
        <Field label="Dateline place (optional)" value={f.dateline} onChange={set('dateline')} placeholder={f.constituency || 'e.g. నరసరావుపేట'} disabled={locked} />

        {error ? <p className="error" role="alert">{error}</p> : null}
        {!locked ? <div className="row">
          <Button kind="accent" onClick={() => save(true)} disabled={busy}>{busy ? 'Saving…' : can.desk ? 'Save and approve' : 'Submit for review'}</Button>
          <Button kind="secondary" onClick={() => save(false)} disabled={busy}>Save as draft</Button>
          <div className="spacer" />
          {id && canDelete ? <Button kind="danger" onClick={remove} disabled={busy}>Delete</Button> : null}
        </div> : null}
      </div>
    </main>
  );
}
