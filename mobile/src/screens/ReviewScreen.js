import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, Text, View } from 'react-native';
import { api, errMsg } from '../api';
import { STATUS } from '../constants';
import { Badge, Button, Field, C } from '../ui';

export default function ReviewScreen({ navigation, route }) {
  const { id } = route.params;
  const [n, setN] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get(`/news/${id}`).then(r => setN(r.data.news)).catch(e => { Alert.alert('Could not open', errMsg(e)); navigation.goBack(); }); }, [id]);

  const review = async action => {
    if (action === 'reject' && !note.trim()) return Alert.alert('Add a note', 'Tell the reporter what to fix before sending it back.');
    setBusy(true);
    try { await api.post(`/news/${id}/review`, { action, note }); navigation.goBack(); }
    catch (e) { Alert.alert('Not saved', errMsg(e)); } finally { setBusy(false); }
  };
  if (!n) return <ActivityIndicator style={{ marginTop: 40 }} color={C.red} />;
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Badge text={STATUS[n.status].label} color={STATUS[n.status].color} />
      <Text style={{ fontSize: 24, fontWeight: '800', color: C.red, marginVertical: 10 }}>{n.title}</Text>
      {(n.highlights || []).length ? <View style={{ backgroundColor: C.pink, padding: 8, borderRadius: 6, marginBottom: 10 }}>
        {n.highlights.map((h, i) => <Text key={i} style={{ color: '#fff', fontWeight: '700' }}>- {h}</Text>)}</View> : null}
      <ScrollView horizontal>{(n.images || []).map(u => <Image key={u} source={{ uri: u }} style={{ width: 260, height: 180, borderRadius: 8, marginRight: 8 }} />)}</ScrollView>
      <Text style={{ color: C.muted, marginTop: 10 }}>{n.constituency}, {n.district}  |  {n.author?.name}</Text>
      <Text style={{ fontSize: 17, lineHeight: 28, color: C.ink, marginVertical: 12 }}>{n.body}</Text>
      {n.status !== 'published' ? <>
        <Field label="Note to reporter (needed when sending back)" value={note} onChangeText={setNote} multiline style={{ minHeight: 70 }} />
        <Button title="Approve for e-paper" onPress={() => review('approve')} disabled={busy} />
        <Button title="Send back to reporter" kind="danger" onPress={() => review('reject')} disabled={busy} style={{ marginTop: 10 }} />
        <Button title="Edit text or photos" kind="secondary" onPress={() => navigation.replace('NewsEditor', { id })} style={{ marginTop: 10 }} />
      </> : null}
    </ScrollView>
  );
}
