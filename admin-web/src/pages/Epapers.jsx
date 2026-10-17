import React, { useEffect, useState } from 'react';
import { api, errMsg } from '../api';
import { SITE_BASE } from '../config';
import { Button, Spinner } from '../ui';

// The drag-and-drop layout studio is a page served by the API server at /studio.
export default function Epapers() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  useEffect(() => { api('/epapers', { params: { limit: 50 } }).then(r => setItems(r.items)).catch(e => setError(errMsg(e))); }, []);

  const shareUrl = e => `${SITE_BASE}/e/${e.shareSlug}`;
  const copy = async e => {
    try { await navigator.clipboard.writeText(shareUrl(e)); setCopied(e._id); setTimeout(() => setCopied(''), 2000); }
    catch { window.prompt('Copy this link:', shareUrl(e)); }
  };

  return (
    <main>
      <div className="panel row">
        <div style={{ flex: 1, minWidth: 240 }}>
          <h2 style={{ marginBottom: 4 }}>E-paper</h2>
          <span className="muted">Arrange approved news on pages, merge pages, publish and save as PDF.</span>
        </div>
        <a className="btn btn-primary" href={`${SITE_BASE}/studio`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>Open layout studio ↗</a>
      </div>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {!items ? (error ? null : <Spinner />) : !items.length ? <p className="muted" style={{ textAlign: 'center' }}>No editions yet. Open the layout studio to make one.</p> : (
        <div className="table-wrap">
          <table className="list">
            <thead><tr><th>Edition</th><th>Date</th><th>Pages</th><th>Status</th><th>Share</th></tr></thead>
            <tbody>
              {items.map(e => (
                <tr key={e._id}>
                  <td><strong>{e.title}</strong></td>
                  <td>{String(e.editionDate).slice(0, 10)}</td>
                  <td>{e.pages?.length || 0}</td>
                  <td>{e.status === 'published' ? 'Published' : 'Draft'}</td>
                  <td>{e.status === 'published' && e.shareSlug ? <div className="row">
                    <a href={shareUrl(e)} target="_blank" rel="noreferrer">Open</a>
                    <Button kind="secondary" onClick={() => copy(e)}>{copied === e._id ? 'Copied' : 'Copy link'}</Button>
                  </div> : <span className="muted">–</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
