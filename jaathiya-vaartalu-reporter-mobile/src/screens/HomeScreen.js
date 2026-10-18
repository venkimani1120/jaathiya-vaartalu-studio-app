import React, { useCallback, useLayoutEffect, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../auth';
import { api, errMsg } from '../api';
import { STATUS } from '../constants';
import { Badge, Button, Chips, C } from '../ui';

const FILTERS = [['', 'All'], ['draft', 'Drafts'], ['submitted', 'Waiting'], ['rejected', 'Sent back'], ['approved,published', 'Approved']];

export default function HomeScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const [status, setStatus] = useState('');
  const [items, setItems] = useState([]);
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useLayoutEffect(() => navigation.setOptions({
    headerRight: () => <Pressable onPress={signOut} hitSlop={10}><Text style={{ color: '#fff', fontWeight: '700' }}>Sign out</Text></Pressable>,
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

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ padding: 12, paddingBottom: 0 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: C.ink }}>{user.name}  <Text style={{ color: C.muted, fontWeight: '400' }}>({user.constituency || user.district || 'reporter'})</Text></Text>
        {quota ? <Text style={{ color: quota.remaining ? C.muted : C.warn, marginTop: 2 }}>Today: {quota.used} of {quota.limit} news cards used</Text> : null}
        <View style={{ marginTop: 12 }}><Chips options={FILTERS} value={status} onChange={setStatus} /></View>
        {error ? <Text style={{ color: C.warn, marginBottom: 8 }}>{error}</Text> : null}
      </View>
      <FlatList
        data={items} keyExtractor={n => n._id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
        ListEmptyComponent={!loading ? <Text style={{ textAlign: 'center', color: C.muted, marginTop: 40 }}>
          {status ? 'No news here.' : 'No news yet. Tap “New news card” to upload your first story.'}</Text> : null}
        renderItem={({ item: n }) => (
          <Pressable onPress={() => navigation.navigate('NewsEditor', { id: n._id })} style={{ backgroundColor: '#fff', borderRadius: 12, padding: 10, marginBottom: 10, flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: C.line }}>
            {n.images?.[0] ? <Image source={{ uri: n.images[0] }} style={{ width: 72, height: 56, borderRadius: 6 }} /> : <View style={{ width: 72, height: 56, borderRadius: 6, backgroundColor: C.bg }} />}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }} numberOfLines={2}>{n.title}</Text>
              <Text style={{ color: C.muted, fontSize: 12, marginVertical: 3 }}>{n.constituency || n.district || ''}</Text>
              <Badge text={STATUS[n.status]?.label} color={STATUS[n.status]?.color} />
              {n.status === 'rejected' && n.reviewNote ? <Text style={{ color: C.warn, fontSize: 12, marginTop: 4 }}>Editor: {n.reviewNote}</Text> : null}
            </View>
          </Pressable>
        )}
      />
      <View style={{ position: 'absolute', left: 16, right: 16, bottom: 24 }}>
        <Button title="New news card" onPress={() => navigation.navigate('NewsEditor')} disabled={quota && quota.remaining === 0} />
      </View>
    </View>
  );
}
