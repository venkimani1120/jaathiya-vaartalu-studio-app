import React, { useCallback, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, errMsg } from '../api';
import { Avatar, Badge, Button, C, Card, Chips, EmptyState, Meta } from '../ui';

const ROLES = [['reporter', 'Reporter', 'mic-outline'], ['editor', 'Editor', 'create-outline'], ['admin', 'Admin', 'shield-checkmark-outline']];

export default function UsersScreen() {
  const [filter, setFilter] = useState('pending');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(null);   // id of the account being saved
  const load = useCallback(async () => {
    setLoading(true);
    try { setItems((await api.get('/users', { params: filter === 'pending' ? { pending: true } : {} })).data.items); }
    catch (e) { Alert.alert('Could not load', errMsg(e)); } finally { setLoading(false); }
  }, [filter]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const update = async (u, body) => {
    setBusy(u.id);
    try { await api.patch(`/users/${u.id}`, body); await load(); } catch (e) { Alert.alert('Not saved', errMsg(e)); } finally { setBusy(null); }
  };
  const toggle = u => (u.active
    ? Alert.alert(`Deactivate ${u.name}?`, 'They will be signed out and cannot sign in until an admin turns the account back on.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Deactivate', style: 'destructive', onPress: () => update(u, { active: false }) }])
    : update(u, { active: true }));

  return (
    <FlatList style={{ backgroundColor: C.bg }} data={items} keyExtractor={u => String(u.id)}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={[C.blue]} tintColor={C.blue} />}
      ListHeaderComponent={<Chips options={[['pending', 'Waiting for approval', 'hourglass-outline'], ['all', 'Everyone', 'people-outline']]} value={filter} onChange={setFilter} />}
      ListEmptyComponent={!loading ? (filter === 'pending'
        ? <EmptyState icon="checkmark-done-outline" title="No one is waiting" text="New reporter sign-ups appear here for approval." />
        : <EmptyState icon="people-outline" title="No accounts yet" />) : null}
      renderItem={({ item: u }) => (
        <Card>
          <View style={s.row}>
            <Avatar name={u.name} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.name} numberOfLines={1}>{u.name}</Text>
              <Badge text={u.active ? 'Active' : 'Not active'} color={u.active ? C.ok : '#B45309'} />
            </View>
          </View>
          <View style={s.meta}>
            <Meta icon="mail-outline" text={u.email} />
            <Meta icon="call-outline" text={u.phone} />
            <Meta icon="location-outline" text={u.constituency || u.district} />
          </View>
          <Chips label="Role" options={ROLES} value={u.role} onChange={role => role !== u.role && update(u, { role })} />
          <Button title={u.active ? 'Deactivate' : 'Approve account'} icon={u.active ? 'ban-outline' : 'checkmark-circle-outline'}
            kind={u.active ? 'danger' : 'primary'} small loading={busy === u.id} onPress={() => toggle(u)} />
        </Card>
      )} />
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '800', color: C.ink, marginBottom: 4 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 6, marginTop: 12, marginBottom: 12 },
});
