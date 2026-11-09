import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, Share, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, errMsg } from '../api';
import { API_BASE } from '../config';
import { Badge, Banner, Button, C, Card, EmptyState, Icon, Meta } from '../ui';

// Editions made in the layout studio (StudioScreen), with share links for published ones.
export default function EpaperScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems((await api.get('/epapers', { params: { limit: 30 } })).data.items); setError(''); }
    catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const share = e => {
    const url = `${API_BASE}/e/${e.shareSlug}`;
    Share.share({ message: `జాతియ వార్తలు ఈ-పేపర్ (${String(e.editionDate).slice(0, 10)}): ${url}`, url });
  };

  const header = (
    <View>
      <View style={s.hero}>
        <View style={s.heroIcon}><Icon name="grid-outline" size={24} color="#fff" /></View>
        <Text style={s.heroTitle}>Layout studio</Text>
        <Text style={s.heroText}>Arrange approved news on pages, merge pages and publish. Works best on a tablet or turned sideways.</Text>
        <Button title="Open layout studio" icon="open-outline" kind="secondary" onPress={() => navigation.navigate('Studio')} style={{ marginTop: 14, borderColor: '#fff' }} />
      </View>
      {error ? <Banner kind="error">{error}</Banner> : null}
      {items.length ? <Text style={s.heading}>Editions</Text> : null}
    </View>
  );
  return (
    <FlatList style={{ backgroundColor: C.bg }} data={items} keyExtractor={e => e._id} ListHeaderComponent={header}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={[C.blue]} tintColor={C.blue} />}
      ListEmptyComponent={!loading && !error ? <EmptyState icon="newspaper-outline" title="No editions yet" text="Editions you build in the layout studio appear here." /> : null}
      renderItem={({ item: e }) => {
        const pub = e.status === 'published';
        return (
          <Card style={s.row}>
            <View style={s.edIcon}><Icon name="newspaper-outline" size={22} color={C.blue} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.title} numberOfLines={2}>{e.title}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 6 }}>
                <Meta icon="calendar-outline" text={String(e.editionDate).slice(0, 10)} />
                <Meta icon="documents-outline" text={`${e.pages?.length || 0} pages`} />
              </View>
              <Badge text={pub ? 'Published' : 'Draft'} color={pub ? C.ok : '#6B7280'} />
            </View>
            {pub ? <Button title="Share" icon="share-social-outline" kind="ghost" small onPress={() => share(e)} style={{ alignSelf: 'center' }} /> : null}
          </Card>
        );
      }} />
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: C.blue, borderRadius: 16, padding: 18, marginBottom: 16, borderBottomWidth: 4, borderBottomColor: C.saffron },
  heroIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  heroTitle: { color: '#fff', fontSize: 19, fontWeight: '800' },
  heroText: { color: 'rgba(255,255,255,.85)', fontSize: 14, lineHeight: 20, marginTop: 4 },
  heading: { fontSize: 13, fontWeight: '800', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 12 },
  edIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '700', color: C.ink },
});
