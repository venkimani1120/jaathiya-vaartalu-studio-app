import React, { useEffect, useRef, useState } from 'react';
import { Button } from './ui';

// Crops one photo: drag on the photo to draw the box, drag inside it to move it, drag a corner to
// resize. onApply gets the box in the photo's own pixels: { x, y, w, h }, plus the <img> element.
const MIN = 0.03;   // smallest box, as a share of the photo's width / height
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

export default function Cropper({ src, onCancel, onApply }) {
  const img = useRef(null);
  const drag = useRef(null);
  const [box, setBox] = useState({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 });   // shares of the shown photo
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const esc = e => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onCancel]);

  const at = e => {
    const r = img.current.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / r.width, 0, 1), y: clamp((e.clientY - r.top) / r.height, 0, 1) };
  };
  const down = e => {
    if (!ready || e.button > 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = at(e), corner = e.target.dataset.corner;
    const inside = p.x > box.x && p.x < box.x + box.w && p.y > box.y && p.y < box.y + box.h;
    drag.current = { mode: corner ? 'resize' : inside ? 'move' : 'draw', corner, start: p, from: box };
  };
  const move = e => {
    const d = drag.current; if (!d) return;
    const p = at(e), { from } = d;
    if (d.mode === 'move') {
      setBox({ ...from, x: clamp(from.x + p.x - d.start.x, 0, 1 - from.w), y: clamp(from.y + p.y - d.start.y, 0, 1 - from.h) });
      return;
    }
    // draw and resize: one corner stays fixed, the other follows the pointer
    const fixed = d.mode === 'draw' ? d.start : {
      x: d.corner.includes('w') ? from.x + from.w : from.x,
      y: d.corner.includes('n') ? from.y + from.h : from.y
    };
    setBox({ x: Math.min(fixed.x, p.x), y: Math.min(fixed.y, p.y), w: Math.abs(p.x - fixed.x), h: Math.abs(p.y - fixed.y) });
  };
  const up = () => {
    drag.current = null;
    setBox(b => (b.w < MIN || b.h < MIN ? { x: 0, y: 0, w: 1, h: 1 } : b));   // a click, not a drag: whole photo
  };

  const apply = () => {
    const { naturalWidth: W, naturalHeight: H } = img.current;
    const x = Math.round(box.x * W), y = Math.round(box.y * H);
    const rect = { x, y, w: Math.min(W - x, Math.max(1, Math.round(box.w * W))), h: Math.min(H - y, Math.max(1, Math.round(box.h * H))) };
    Promise.resolve(onApply(rect, img.current)).catch(e => setError(e.message || 'Could not crop this photo.'));
  };
  const size = img.current && ready ? `${Math.round(box.w * img.current.naturalWidth)} × ${Math.round(box.h * img.current.naturalHeight)} px` : '';
  const pct = v => `${v * 100}%`;

  return (
    <div className="crop-modal" role="dialog" aria-modal="true" aria-label="Crop photo">
      <div className="crop-sheet">
        <div className="crop-bar">
          <b>Crop photo</b><span className="muted">{size}</span>
          <div className="spacer" />
          <Button kind="secondary" onClick={() => setBox({ x: 0, y: 0, w: 1, h: 1 })} disabled={!ready}>Whole photo</Button>
          <Button kind="secondary" onClick={onCancel}>Cancel</Button>
          <Button onClick={apply} disabled={!ready}>Apply crop</Button>
        </div>
        <p className="muted crop-hint">Drag on the photo to draw the crop, drag inside it to move it, or drag a corner to resize it.</p>
        {error ? <p className="error" role="alert">{error}</p> : null}
        <div className="crop-stage">
          <div className="crop-frame" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
            <img ref={img} src={src} alt="" crossOrigin="anonymous" draggable={false}
              onLoad={() => setReady(true)} onError={() => setError('This photo could not be loaded.')} />
            {ready ? <div className="crop-box" style={{ left: pct(box.x), top: pct(box.y), width: pct(box.w), height: pct(box.h) }}>
              {['nw', 'ne', 'sw', 'se'].map(c => <span key={c} className={`crop-h crop-${c}`} data-corner={c} />)}
            </div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// The cropped photo. A Cloudinary photo gets a crop step added to its address (nothing is uploaded,
// no quality is lost); anything else is cut in the browser and returned as a new file to upload.
export async function cropPhoto(url, rect, imgEl) {
  const t = `c_crop,x_${rect.x},y_${rect.y},w_${rect.w},h_${rect.h}`;
  if (url.includes('/image/upload/') && /\/v\d+\//.test(url)) return { url: url.replace(/\/(v\d+\/)/, `/${t}/$1`) };
  const canvas = document.createElement('canvas');
  canvas.width = rect.w; canvas.height = rect.h;
  canvas.getContext('2d').drawImage(imgEl, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
  let blob;
  try { blob = await new Promise((ok, no) => canvas.toBlob(b => (b ? ok(b) : no(new Error())), 'image/jpeg', 0.92)); }
  catch { throw new Error('This photo cannot be cropped here (its server does not allow it). Download it, crop it and add it again.'); }
  const file = new File([blob], 'cropped.jpg', { type: 'image/jpeg' });
  return { url: URL.createObjectURL(file), file };
}
