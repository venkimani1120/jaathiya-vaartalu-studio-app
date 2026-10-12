import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE } from './config';

export const api = axios.create({ baseURL: API_BASE + '/api', timeout: 30000 });
let onSignedOut = () => {};
export const setSignedOutHandler = fn => { onSignedOut = fn; };

export async function saveTokens({ accessToken, refreshToken }) {
  await SecureStore.setItemAsync('access', accessToken);
  await SecureStore.setItemAsync('refresh', refreshToken);
}
export async function clearTokens() {
  await SecureStore.deleteItemAsync('access');
  await SecureStore.deleteItemAsync('refresh');
}
export const getAccessToken = () => SecureStore.getItemAsync('access');

api.interceptors.request.use(async cfg => {
  const t = await SecureStore.getItemAsync('access');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// On 401, try one silent refresh (shared across parallel requests), then retry.
let refreshing = null;
async function refresh() {
  const rt = await SecureStore.getItemAsync('refresh');
  if (!rt) return false;
  try {
    const { data } = await axios.post(API_BASE + '/api/auth/refresh', { refreshToken: rt });
    await saveTokens(data);
    return true;
  } catch { return false; }
}
api.interceptors.response.use(r => r, async err => {
  const orig = err.config || {};
  if (err.response?.status === 401 && !orig._retry && !String(orig.url).startsWith('/auth/')) {
    orig._retry = true;
    refreshing = refreshing || refresh().finally(() => { refreshing = null; });
    if (await refreshing) return api(orig);
    await clearTokens();
    onSignedOut();
  }
  return Promise.reject(err);
});

export const errMsg = e => e?.response?.data?.message || (e?.message === 'Network Error' ? 'No connection to the server. Check the internet and try again.' : e?.message) || 'Something went wrong.';

// Uploads local photos and returns their hosted URLs.
export async function uploadImages(assets) {
  if (!assets.length) return [];
  const form = new FormData();
  assets.forEach((a, i) => form.append('images', { uri: a.uri, name: a.fileName || `photo-${i}.jpg`, type: a.mimeType || 'image/jpeg' }));
  const { data } = await api.post('/uploads', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 });
  return data.urls;
}
