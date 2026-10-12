import React, { useCallback, useLayoutEffect, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../auth';
import { api, errMsg } from '../api';
import { STATUS } from '../constants';
import PlacePicker from '../PlacePicker';
import { Badge, Button, Chips, C } from '../ui';

export default function HomeScreen({ navigation }) {
  const { user, can, signOut } = useAuth();
  const tabs = [['mine', 'My news'], ...(can.review ? [['review', 'Review'], ['approved', 'Ready to place']] : [])];
  const [tab, setTab] = useState(can.review ? 'review' : 'mine');
  const [place, setPlace] = useState({ state: '', district: '', constituency: '' });
  const [items, setItems] = useState([]);
  const [quota, setQuota] = useState(null);
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
      if (place.state) params.state = place.state;
      if (place.district) params.district = place.district;
      if (place.constituency) params.constituency = place.constituency;
      const { data } = await api.get('/news', { params });
      // "My news" for desk staff = their own uploads
      setItems(tab === 'mine' && can.review ? data.items.filter(n => n.author?._id === user.id) : data.items);
      if (user.role === 'reporter') setQuota((await api.get('/news/quota/today')).data);
    } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }, [tab, place, can.review, user]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const open = n => (tab === 'mine' ? navigation.navigate('NewsEditor', { id: n._id }) : navigation.navigate('Review', { id: n._id }));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ padding: 12, paddingBottom: 0 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: C.ink }}>{user.name}  <Text style={{ color: C.muted, fontWeight: '400' }}>({user.role})</Text></Text>
        {quota ? <Text style={{ color: quota.remaining ? C.muted : C.warn, marginTop: 2 }}>Today: {quota.used} of {quota.limit} news cards used</Text> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {can.epaper ? <Button title="E-paper" kind="secondary" onPress={() => navigation.navigate('Epaper')} style={{ paddingVertical: 8 }} /> : null}
          {can.users ? <Button title="Team accounts" kind="secondary" onPress={() => navigation.navigate('Users')} style={{ paddingVertical: 8 }} /> : null}
        </View>
        <View style={{ marginTop: 12 }}><Chips options={tabs} value={tab} onChange={setTab} /></View>
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
