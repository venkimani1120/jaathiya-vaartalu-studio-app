import React, { useCallback, useLayoutEffect, useState } from 'react';
import { FlatList, Platform, Pressable, RefreshControl, Share, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../auth';
import { api, errMsg } from '../api';
import { API_BASE } from '../config';
import { Avatar, Badge, Banner, Button, C, Card, EmptyState, Icon, IconButton, Meta } from '../ui';

// One big action on the dashboard.
const Action = ({ icon, title, text, onPress }) => (
  <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.action, pressed && { backgroundColor: C.blueSoft }]}>
    <View style={s.actionIcon}><Icon name={icon} size={22} color={C.blue} /></View>
    <View style={{ flex: 1 }}>
      <Text style={s.actionTitle}>{title}</Text>
      <Text style={s.actionText}>{text}</Text>
    </View>
    <Icon name="chevron-forward" size={18} color={C.faint} />
  </Pressable>
);

// The studio app's start: what to do (layout, upload a paper, upload a news cut), then the editions made so far.
export default function HomeScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useLayoutEffect(() => navigation.setOptions({
    headerRight: () => <IconButton icon="log-out-outline" color="#fff" label="Sign out" onPress={signOut} />,
  }), [navigation, signOut]);

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
      <Card style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Avatar name={user.name} size={46} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.hello} numberOfLines={1}>{user.name}</Text>
            <Badge text={user.role === 'admin' ? 'Admin' : 'Editor'} color={user.role === 'admin' ? C.ok : C.blue} />
          </View>
        </View>
      </Card>
      <View style={s.hero}>
        <View style={s.heroIcon}><Icon name="grid-outline" size={24} color="#fff" /></View>
        <Text style={s.heroTitle}>Layout studio</Text>
        <Text style={s.heroText}>Arrange approved news on pages, merge pages and publish. Works best on a tablet or turned sideways.</Text>
        <Button title="Open layout studio" icon="open-outline" kind="secondary" onPress={() => navigation.navigate('Studio')} style={{ marginTop: 14, borderColor: '#fff' }} />
      </View>
      <Card>
        <Action icon="newspaper-outline" title="Upload newspaper" text="A PDF or page photos of a paper. Its news is read and listed for you to add to the feed."
          onPress={() => navigation.navigate('Imports')} />
        <View style={s.sep} />
        <Action icon="cut-outline" title="Upload news cut" text="A photo of a small news cutting with its headline and text. It goes straight to the approved pool."
          onPress={() => navigation.navigate('NewsCut')} />
      </Card>
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
            {pub ? <Button title="Share" icon={Platform.OS === 'ios' ? 'share-outline' : 'share-social-outline'} kind="ghost" small onPress={() => share(e)} style={{ alignSelf: 'center' }} /> : null}
          </Card>
        );
      }} />
  );
}

const s = StyleSheet.create({
  hello: { fontSize: 17, fontWeight: '800', color: C.ink, marginBottom: 4 },
  hero: { backgroundColor: C.blue, borderRadius: 16, padding: 18, marginBottom: 12, borderBottomWidth: 4, borderBottomColor: C.saffron },
  heroIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  heroTitle: { color: '#fff', fontSize: 19, fontWeight: '800' },
  heroText: { color: 'rgba(255,255,255,.85)', fontSize: 14, lineHeight: 20, marginTop: 4 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderRadius: 12 },
  actionIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontSize: 15, fontWeight: '800', color: C.ink },
  actionText: { fontSize: 13, color: C.muted, lineHeight: 18, marginTop: 2 },
  sep: { height: 1, backgroundColor: C.line, marginVertical: 8 },
  heading: { fontSize: 13, fontWeight: '800', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 12 },
  edIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '700', color: C.ink },
});
