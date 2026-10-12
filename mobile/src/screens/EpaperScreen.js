import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Share, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useFocusEffect } from '@react-navigation/native';
import { api, errMsg, getAccessToken } from '../api';
import { API_BASE } from '../config';
import { Button, C } from '../ui';

// The drag-and-drop layout studio is a web page served by the API; we open it here with the user's session.
export default function EpaperScreen() {
  const [mode, setMode] = useState('list');
  const [token, setToken] = useState(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setItems((await api.get('/epapers', { params: { limit: 30 } })).data.items); setError(''); }
    catch (e) { setError(errMsg(e)); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openStudio = async () => {
    await api.get('/auth/me');                       // refreshes the token if it expired
    setToken(await getAccessToken()); setMode('studio');
  };
  const share = e => {
    const url = `${API_BASE}/e/${e.shareSlug}`;
    Share.share({ message: `జాతియ వార్తలు ఈ-పేపర్ (${String(e.editionDate).slice(0, 10)}): ${url}`, url });
  };

  if (mode === 'studio') return (
    <View style={{ flex: 1 }}>
      <WebView source={{ uri: `${API_BASE}/studio` }} startInLoadingState
        renderLoading={() => <ActivityIndicator style={{ marginTop: 40 }} color={C.red} />}
        injectedJavaScriptBeforeContentLoaded={`window.__JV_TOKEN=${JSON.stringify(token)};true;`} />
      <View style={{ padding: 8, backgroundColor: '#fff' }}><Button title="Back to editions" kind="secondary" onPress={() => { setMode('list'); load(); }} /></View>
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ padding: 12 }}>
        <Button title="Open layout studio" onPress={openStudio} />
        <Text style={{ color: C.muted, marginTop: 8, fontSize: 13 }}>Arrange approved news on pages, merge pages and publish. Works best on a tablet or turned sideways.</Text>
        {error ? <Text style={{ color: C.warn, marginTop: 8 }}>{error}</Text> : null}
      </View>
      <FlatList data={items} keyExtractor={e => e._id} contentContainerStyle={{ padding: 12 }}
        renderItem={({ item: e }) => (
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: C.line }}>
            <Text style={{ fontWeight: '700', fontSize: 15 }}>{e.title}</Text>
            <Text style={{ color: C.muted, marginVertical: 4 }}>{String(e.editionDate).slice(0, 10)}  |  {e.pages?.length || 0} pages  |  {e.status === 'published' ? 'Published' : 'Draft'}</Text>
            {e.status === 'published' ? <Pressable onPress={() => share(e)}><Text style={{ color: C.blue, fontWeight: '700' }}>Share link</Text></Pressable> : null}
          </View>
        )} />
    </View>
  );
}
