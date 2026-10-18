import React, { useEffect, useRef } from 'react';
import { SITE_BASE } from '../config';

// The layout studio is a page served by the API server at /studio. When this app is on the same site
// (served at /app/, or the Vite dev proxy) it runs inside the app and shares the sign-in.
// On another site the browser blocks both, so it opens in a new tab instead.
export const STUDIO_URL = `${SITE_BASE}/studio`;
export const studioEmbeddable = () => { try { return new URL(STUDIO_URL).origin === window.location.origin; } catch { return false; } };

// Kept mounted (just hidden) after the first visit, so switching tabs never loses unsaved layout work.
export default function StudioFrame({ visible }) {
  const frame = useRef(null);
  useEffect(() => {
    if (visible) frame.current?.contentWindow?.postMessage({ type: 'jv:refresh-pool' }, window.location.origin);
  }, [visible]);
  return <iframe ref={frame} className="studio-frame" src={STUDIO_URL} title="E-paper layout studio" hidden={!visible} allow="clipboard-write; web-share" />;
}
