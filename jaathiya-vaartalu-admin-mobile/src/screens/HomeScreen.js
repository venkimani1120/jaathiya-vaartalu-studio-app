import React, { useCallback, useLayoutEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../auth';
import { api, errMsg } from '../api';
import { SOURCES, STATUS } from '../constants';
import PlacePicker from '../PlacePicker';
import { Avatar, Badge, Banner, C, Card, Chips, EmptyState, Fab, Icon, NewsItem } from '../ui';

const TABS = [['review', 'Review', 'time-outline'], ['approved', 'Ready to place', 'checkmark-done-outline'], ['mine', 'My news', 'create-outline']];
const EMPTY = {
  review: ['checkmark-circle-outline', 'All caught up', 'Nothing is waiting for review.'],
  approved: ['albums-outline', 'No approved news yet', 'Approved stories show here, ready for the layout studio in the JV Studio app.'],
  mine: ['create-outline', 'No news yet', 'Tap “New news card” to upload your first story.'],
};

// One shortcut tile in the row under the profile.
const Tile = ({ icon, title, onPress }) => (
  <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.tile, pressed && { backgroundColor: C.blueSoft }]}>
    <View style={s.tileIcon}><Icon name={icon} size={20} color={C.blue} /></View>
    <Text style={s.tileText} numberOfLines={1}>{title}</Text>
  </Pressable>
);

export default function HomeScreen({ navigation }) {
  const { user, can } = useAuth();
  const [tab, setTab] = useState('review');
  const [source, setSource] = useState('');
  const [counts, setCounts] = useState(null);
  const [place, setPlace] = useState({ state: '', district: '', constituency: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useLayoutEffect(() => navigation.setOptions({
    headerRight: () => (
      <Pressable onPress={() => navigation.navigate('Profile')} hitSlop={10} accessibilityRole="button" accessibilityLabel={`My profile (${user.name})`}
        style={({ pressed }) => [s.headAvatar, pressed && { opacity: 0.7 }]}>
        <Avatar name={user.name} uri={user.avatar} size={32} />
      </Pressable>
    ),
  }), [navigation, user]);

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
  const sourceChips = [['', `All${countOf('')}`], ...Object.entries(SOURCES).map(([k, x]) => [k, `${x.label}${countOf(k)}`])];
  const active = [source, place.state, place.district, place.constituency].filter(Boolean).length;
  const open = n => (tab === 'mine' ? navigation.navigate('NewsEditor', { id: n._id }) : navigation.navigate('Review', { id: n._id }));
  const [eIcon, eTitle, eText] = EMPTY[tab];

  const header = (
    <View>
      <Card style={{ padding: 14 }}>
        <Pressable onPress={() => navigation.navigate('Profile')} accessibilityRole="button" accessibilityLabel="My profile"
          style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center' }, pressed && { opacity: 0.7 }]}>
          <Avatar name={user.name} uri={user.avatar} size={46} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.hello} numberOfLines={1}>{user.name}</Text>
            <Badge text={user.role === 'admin' ? 'Admin' : 'Editor'} color={user.role === 'admin' ? C.ok : C.blue} />
          </View>
          <Icon name="chevron-forward" size={18} color={C.faint} />
        </Pressable>
        {can.users ? <View style={s.tiles}>
          <Tile icon="people-outline" title="Team" onPress={() => navigation.navigate('Users')} />
        </View> : null}
      </Card>

      <Chips options={TABS} value={tab} onChange={setTab} />
      {tab !== 'mine' ? (
        <Pressable onPress={() => setShowFilters(v => !v)} style={s.filterBar} accessibilityRole="button" accessibilityState={{ expanded: showFilters }}>
          <Icon name="options-outline" size={18} color={C.blue} />
          <Text style={s.filterText}>Filters{active ? ` · ${active} on` : ''}</Text>
          {counts ? <Text style={s.count}>{counts.total} stories</Text> : null}
          <Icon name={showFilters ? 'chevron-up' : 'chevron-down'} size={18} color={C.muted} />
        </Pressable>
      ) : null}
      {tab !== 'mine' && showFilters ? (
        <Card style={{ paddingBottom: 4 }}>
          <Chips label="Source" options={sourceChips} value={source} onChange={setSource} />
          <PlacePicker value={place} onChange={setPlace} allowAll />
        </Card>
      ) : null}
      {error ? <Banner kind="error">{error}</Banner> : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <FlatList
        data={items} keyExtractor={n => n._id} ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={[C.blue]} tintColor={C.blue} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        ListEmptyComponent={!loading ? <EmptyState icon={eIcon} title={eTitle} text={eText} /> : null}
        renderItem={({ item: n }) => {
          const src = SOURCES[n.source || 'reporter'];
          return <NewsItem news={n} author={n.author?.name} onPress={() => open(n)}
            badges={[[STATUS[n.status]?.label, STATUS[n.status]?.color], [src?.label, src?.color]]} />;
        }}
      />
      <Fab title="New news card" onPress={() => navigation.navigate('NewsEditor')} />
    </View>
  );
}

const s = StyleSheet.create({
  headAvatar: { borderRadius: 18, borderWidth: 2, borderColor: 'rgba(255,255,255,.7)' },
  hello: { fontSize: 17, fontWeight: '800', color: C.ink, marginBottom: 4 },
  tiles: { flexDirection: 'row', gap: 8, marginTop: 14 },
  tile: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: C.line },
  tileIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  tileText: { fontSize: 12, fontWeight: '700', color: C.ink },
  filterBar: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 14, marginBottom: 12,
    borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: C.line },
  filterText: { flex: 1, fontSize: 14, fontWeight: '700', color: C.ink },
  count: { fontSize: 12, color: C.muted },
});
