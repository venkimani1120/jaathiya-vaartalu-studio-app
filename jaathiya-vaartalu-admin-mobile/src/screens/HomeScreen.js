import React, { useCallback, useLayoutEffect, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../auth';
import { api, errMsg } from '../api';
import { SOURCES, STATUS } from '../constants';
import PlacePicker from '../PlacePicker';
import { Badge, Button, Chips, C } from '../ui';

export default function HomeScreen({ navigation }) {
  const { user, can, signOut } = useAuth();
  const tabs = [['review', 'Review'], ['approved', 'Ready to place'], ['mine', 'My news']];
  const [tab, setTab] = useState('review');
  const [source, setSource] = useState('');
  const [counts, setCounts] = useState(null);
  const [place, setPlace] = useState({ state: '', district: '', constituency: '' });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useLayoutEffect(() => navigation.setOptions({
    headerRight: () => <Pressable onPress={signOut} hitSlop={10}><Text style={{ color: '#fff', fontWeight: '700' }}>Sign out</Text></Pressable>,
  }), [navigation, signOut]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = { limit: 100 };
      if (tab === 'review') params.status = 'submitted';
      if (tab === 'approved') params.status = 'approved';
      if (tab === 'mine') params.author = 'me';
      if (place.state) params.state = place.state;
      if (place.district) params.district = place.district;
      if (place.constituency) params.constituency = place.constituency;
      const [{ data }, c] = await Promise.all([
        api.get('/news', { params: source ? { ...params, source } : params }),
        api.get('/news/counts', { params }).catch(() => null),
      ]);
      setCounts(c ? c.data : null);
      // "My news" for desk staff = their own uploads
      setItems(data.items);
    } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }, [tab, source, place, user]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const countOf = k => (counts ? ` ${k ? counts.counts[k] : counts.total}` : '');
  const sourceChips = [['', `All${countOf('')}`], ...Object.entries(SOURCES).map(([k, s]) => [k, `${s.label}${countOf(k)}`])];
  const open = n => (tab === 'mine' ? navigation.navigate('NewsEditor', { id: n._id }) : navigation.navigate('Review', { id: n._id }));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ padding: 12, paddingBottom: 0 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: C.ink }}>{user.name}  <Text style={{ color: C.muted, fontWeight: '400' }}>({user.role})</Text></Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {can.epaper ? <Button title="E-paper" kind="secondary" onPress={() => navigation.navigate('Epaper')} style={{ paddingVertical: 8 }} /> : null}
          {can.users ? <Button title="Team accounts" kind="secondary" onPress={() => navigation.navigate('Users')} style={{ paddingVertical: 8 }} /> : null}
        </View>
        <View style={{ marginTop: 12 }}><Chips options={tabs} value={tab} onChange={setTab} /></View>
        {tab !== 'mine' ? <Chips options={sourceChips} value={source} onChange={setSource} /> : null}
        {tab !== 'mine' ? <PlacePicker value={place} onChange={setPlace} allowAll labels={false} /> : null}
        {error ? <Text style={{ color: C.warn, marginBottom: 8 }}>{error}</Text> : null}
      </View>
      <FlatList
        data={items} keyExtractor={n => n._id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
        ListEmptyComponent={!loading ? <Text style={{ textAlign: 'center', color: C.muted, marginTop: 40 }}>
          {tab === 'review' ? 'Nothing waiting for review.' : tab === 'approved' ? 'No approved news yet.' : 'No news yet. Tap “New news card” to upload your first story.'}</Text> : null}
        renderItem={({ item: n }) => (
          <Pressable onPress={() => open(n)} style={{ backgroundColor: '#fff', borderRadius: 12, padding: 10, marginBottom: 10, flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: C.line }}>
            {n.images?.[0] ? <Image source={{ uri: n.images[0] }} style={{ width: 72, height: 56, borderRadius: 6 }} /> : <View style={{ width: 72, height: 56, borderRadius: 6, backgroundColor: C.bg }} />}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }} numberOfLines={2}>{n.title}</Text>
              <Text style={{ color: C.muted, fontSize: 12, marginVertical: 3 }}>{n.constituency || n.district || ''}{n.author?.name ? `, ${n.author.name}` : ''}</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Badge text={STATUS[n.status]?.label} color={STATUS[n.status]?.color} />
                <Badge text={SOURCES[n.source || 'reporter']?.label} color={SOURCES[n.source || 'reporter']?.color} />
              </View>
              {n.status === 'rejected' && n.reviewNote ? <Text style={{ color: C.warn, fontSize: 12, marginTop: 4 }}>Editor: {n.reviewNote}</Text> : null}
            </View>
          </Pressable>
        )}
      />
      <View style={{ position: 'absolute', left: 16, right: 16, bottom: 24 }}>
        <Button title="New news card" onPress={() => navigation.navigate('NewsEditor')} />
      </View>
    </View>
  );
}
