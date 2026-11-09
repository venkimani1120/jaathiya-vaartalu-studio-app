import React, { useCallback, useLayoutEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../auth';
import { api, errMsg } from '../api';
import { STATUS } from '../constants';
import { Avatar, Banner, C, Card, Chips, EmptyState, Fab, IconButton, Meta, NewsItem } from '../ui';

const FILTERS = [['', 'All', 'list-outline'], ['draft', 'Drafts', 'document-outline'], ['submitted', 'Waiting', 'time-outline'],
  ['rejected', 'Sent back', 'arrow-undo-outline'], ['approved,published', 'Approved', 'checkmark-done-outline']];

export default function HomeScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const [status, setStatus] = useState('');
  const [items, setItems] = useState([]);
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useLayoutEffect(() => navigation.setOptions({
    headerRight: () => <IconButton icon="log-out-outline" color="#fff" label="Sign out" onPress={signOut} />,
  }), [navigation, signOut]);

  // The server only returns the reporter's own cards.
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [news, q] = await Promise.all([
        api.get('/news', { params: { limit: 100, ...(status ? { status } : {}) } }),
        api.get('/news/quota/today'),
      ]);
      setItems(news.data.items); setQuota(q.data);
    } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }, [status]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const full = quota && quota.remaining === 0;
  const pct = quota ? Math.min(100, Math.round((quota.used / Math.max(quota.limit, 1)) * 100)) : 0;
  const header = (
    <View>
      <Card style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Avatar name={user.name} size={46} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.hello} numberOfLines={1}>{user.name}</Text>
            <Meta icon="location-outline" text={user.constituency || user.district || 'Reporter'} />
          </View>
        </View>
        {quota ? (
          <View style={{ marginTop: 14 }}>
            <View style={s.quotaRow}>
              <Text style={s.quotaLabel}>Today's news cards</Text>
              <Text style={[s.quotaNum, full && { color: C.warn }]}>{quota.used} / {quota.limit}</Text>
            </View>
            <View style={s.track}><View style={[s.fill, { width: `${pct}%` }, full && { backgroundColor: C.warn }]} /></View>
          </View>
        ) : null}
      </Card>
      {full ? <Banner kind="warn">You've used today's limit. You can upload again tomorrow.</Banner> : null}
      <Chips options={FILTERS} value={status} onChange={setStatus} />
      {error ? <Banner kind="error">{error}</Banner> : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <FlatList
        data={items} keyExtractor={n => n._id} ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={[C.blue]} tintColor={C.blue} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        ListEmptyComponent={!loading ? (status
          ? <EmptyState icon="file-tray-outline" title="Nothing here" text="No news with this status." />
          : <EmptyState icon="create-outline" title="No news yet" text="Tap “New news card” to upload your first story." />) : null}
        renderItem={({ item: n }) => (
          <NewsItem news={n} onPress={() => navigation.navigate('NewsEditor', { id: n._id })}
            badges={[[STATUS[n.status]?.label, STATUS[n.status]?.color]]} />
        )}
      />
      <Fab title="New news card" onPress={() => navigation.navigate('NewsEditor')} disabled={full} />
    </View>
  );
}

const s = StyleSheet.create({
  hello: { fontSize: 17, fontWeight: '800', color: C.ink, marginBottom: 3 },
  quotaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  quotaLabel: { fontSize: 13, fontWeight: '600', color: C.ink },
  quotaNum: { fontSize: 13, fontWeight: '800', color: C.blue },
  track: { height: 8, borderRadius: 4, backgroundColor: C.blueSoft, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: C.saffron },
});
