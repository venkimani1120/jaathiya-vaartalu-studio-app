import React, { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Share, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { api, errMsg, getAccessToken } from '../api';
import { API_BASE } from '../config';
import { useAuth } from '../auth';
import { Button, C, EmptyState, Loading } from '../ui';

// The drag-and-drop layout studio is the same web page the web app shows (served by the API at /studio).
// Like the web app, this app owns the sign-in: the studio asks for an access token whenever it needs one
// (at start and after each 15-minute expiry) and says when the session is over; it never signs in itself,
// which would end this app's session (one session per user).
const STUDIO_URL = `${API_BASE}/studio`;
const ORIGIN = (API_BASE.match(/^https?:\/\/[^/]+/) || [API_BASE])[0];
// Delivers a message the way the studio's window listener expects it (from its own origin).
const deliver = msg => `window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(msg)}, origin: location.origin }));true;`;

export default function StudioScreen({ navigation }) {
  const web = useRef(null);
  const leave = useRef(null);   // the navigation action waiting for the studio to save
  const { user } = useAuth();
  const [error, setError] = useState('');
  const send = msg => web.current?.injectJavaScript(deliver(msg));
  const goBack = action => { leave.current = 'done'; navigation.dispatch(action); };

  // Save the open edition before leaving, as the web app keeps the studio loaded to avoid losing work.
  useEffect(() => navigation.addListener('beforeRemove', e => {
    if (leave.current === 'done' || error) return;
    e.preventDefault();
    if (leave.current) return;
    leave.current = e.data.action;
    send({ type: 'jv:save' });
    setTimeout(() => { if (leave.current && leave.current !== 'done') goBack(leave.current); }, 10000);
  }), [navigation, error]);

  const onSaved = ({ ok, error: why }) => {
    const action = leave.current; if (!action || action === 'done') return;
    if (ok) return goBack(action);
    Alert.alert('Not saved', `Your latest changes could not be saved${why ? ` (${why})` : ''}. Leave anyway and lose them?`, [
      { text: 'Stay', style: 'cancel', onPress: () => { leave.current = null; } },
      { text: 'Leave', style: 'destructive', onPress: () => goBack(action) },
    ]);
  };

  const sendToken = async () => {
    try {
      await api.get('/auth/me');                     // refreshes the session if the token expired
      send({ type: 'jv:token', token: await getAccessToken(), user });
    } catch (e) {
      send({ type: 'jv:token', token: null });       // a 401 signs this app out (back to its sign-in)
      if (e.response?.status !== 401) setError(errMsg(e));
    }
  };
  // The studio lost its session: if this app's session still works it was a network blip, so reload.
  const onSignedOut = async () => {
    try { await api.get('/auth/me'); web.current?.reload(); }
    catch (e) { if (e.response?.status !== 401) setError(errMsg(e)); }
  };

  const onMessage = ({ nativeEvent }) => {
    let m; try { m = JSON.parse(nativeEvent.data); } catch { return; }
    if (m.type === 'jv:token-request') sendToken();
    else if (m.type === 'jv:signed-out') onSignedOut();
    else if (m.type === 'jv:saved') onSaved(m);
    else if (m.type === 'jv:share') Share.share({ message: m.text, url: m.url });
    else if (m.type === 'jv:open' && /^https?:/.test(m.url)) Linking.openURL(m.url);
  };
  // Links away from the studio (WhatsApp, published editions) open in the phone's apps, not in here.
  const external = url => { if (/^(https?|mailto|tel|whatsapp):/.test(url)) Linking.openURL(url).catch(() => {}); };
  const stayInside = req => {
    if (req.url.startsWith(ORIGIN) || /^(about|data|blob):/.test(req.url)) return true;
    external(req.url); return false;
  };

  if (error) return (
    <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center' }}>
      <EmptyState icon="cloud-offline-outline" title="Layout studio didn't open" text={error}>
        <Button title="Try again" icon="refresh" onPress={() => { leave.current = null; setError(''); }} style={{ marginTop: 18, alignSelf: 'stretch' }} />
      </EmptyState>
    </View>
  );
  return (
    <WebView ref={web} source={{ uri: STUDIO_URL }} style={{ flex: 1 }}
      startInLoadingState renderLoading={() => <View style={StyleSheet.absoluteFill}><Loading /></View>}
      domStorageEnabled textZoom={100} setSupportMultipleWindows
      onMessage={onMessage} onShouldStartLoadWithRequest={stayInside}
      onOpenWindow={e => external(e.nativeEvent.targetUrl)}
      onError={e => setError(`Could not open the layout studio (${e.nativeEvent.description}).`)}
      onHttpError={e => { if (e.nativeEvent.url.startsWith(STUDIO_URL)) setError(`Could not open the layout studio (error ${e.nativeEvent.statusCode}).`); }}
      onRenderProcessGone={() => web.current?.reload()} onContentProcessDidTerminate={() => web.current?.reload()} />
  );
}
