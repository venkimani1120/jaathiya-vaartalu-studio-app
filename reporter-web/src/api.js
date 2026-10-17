import { API_BASE } from './config';

// Tokens live in this browser's localStorage under keys unique to this app.
const KEYS = { access: 'jvr_token', refresh: 'jvr_refresh' };
const read = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const remove = k => { try { localStorage.removeItem(k); } catch {} };
export const saveTokens = d => { write(KEYS.access, d.accessToken); write(KEYS.refresh, d.refreshToken); };
export const clearTokens = () => { remove(KEYS.access); remove(KEYS.refresh); };
export const hasSession = () => !!read(KEYS.refresh);

let onSignedOut = () => {};
export const setSignedOutHandler = fn => { onSignedOut = fn; };

const NO_REFRESH = ['/auth/login', '/auth/signup', '/auth/refresh'];
let refreshing = null;
async function refresh() {
  const refreshToken = read(KEYS.refresh);
  if (!refreshToken) return false;
  try {
    const r = await fetch(API_BASE + '/api/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }) });
    if (!r.ok) return false;
    saveTokens(await r.json());
    return true;
  } catch { return false; }
}

// api('/news', { params, method, body }). body may be a plain object (sent as JSON) or FormData.
// On 401, tries one silent refresh (shared across parallel requests), then retries.
export async function api(path, { method = 'GET', params, body, retry = true } = {}) {
  const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null)) : '';
  const headers = {};
  const token = read(KEYS.access);
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload = body;
  if (body && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  let r;
  try { r = await fetch(API_BASE + '/api' + path + qs, { method, headers, body: payload }); }
  catch { throw new Error('No connection to the server. Check the internet and try again.'); }
  if (r.status === 401 && retry && !NO_REFRESH.includes(path)) {
    refreshing = refreshing || refresh().finally(() => { refreshing = null; });
    if (await refreshing) return api(path, { method, params, body, retry: false });
    clearTokens(); onSignedOut();
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(data.message || `Request failed (${r.status}).`); e.status = r.status; throw e; }
  return data;
}

export const errMsg = e => e?.message || 'Something went wrong.';

// Uploads picked files and returns their hosted URLs.
export async function uploadImages(files) {
  if (!files.length) return [];
  const form = new FormData();
  files.forEach(f => form.append('images', f, f.name));
  return (await api('/uploads', { method: 'POST', body: form })).urls;
}
