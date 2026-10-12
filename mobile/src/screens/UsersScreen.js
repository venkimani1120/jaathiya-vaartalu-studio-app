import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, errMsg } from '../api';
import { Chips, Button, C } from '../ui';

export default function UsersScreen() {
  const [filter, setFilter] = useState('pending');
  const [items, setItems] = useState([]);
  const load = useCallback(async () => {
    try { setItems((await api.get('/users', { params: filter === 'pending' ? { pending: true } : {} })).data.items); }
    catch (e) { Alert.alert('Could not load', errMsg(e)); }
  }, [filter]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const update = async (u, body) => { try { await api.patch(`/users/${u.id}`, body); load(); } catch (e) { Alert.alert('Not saved', errMsg(e)); } };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, padding: 12 }}>
      <Chips options={[['pending', 'Waiting for approval'], ['all', 'Everyone']]} value={filter} onChange={setFilter} />
      <FlatList data={items} keyExtractor={u => String(u.id)}
        ListEmptyComponent={<Text style={{ color: C.muted, textAlign: 'center', marginTop: 30 }}>No accounts here.</Text>}
        renderItem={({ item: u }) => (
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: C.line }}>
            <Text style={{ fontWeight: '700', fontSize: 15 }}>{u.name}</Text>
            <Text style={{ color: C.muted }}>{u.email}  {u.phone || ''}</Text>
            <Text style={{ color: C.muted, marginBottom: 8 }}>{u.constituency || u.district || ''}</Text>
            <Chips options={[['reporter', 'Reporter'], ['editor', 'Editor'], ['admin', 'Admin']]} value={u.role} onChange={role => update(u, { role })} />
            <Button title={u.active ? 'Deactivate' : 'Approve account'} kind={u.active ? 'danger' : 'primary'} onPress={() => update(u, { active: !u.active })} />
          </View>
        )} />
    </View>
  );
}
