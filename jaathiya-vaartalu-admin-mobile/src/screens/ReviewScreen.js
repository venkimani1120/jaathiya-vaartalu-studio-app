import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, errMsg } from '../api';
import { SOURCES, STATUS } from '../constants';
import { Badge, Button, C, Card, Field, Icon, Loading, Meta, SectionTitle } from '../ui';

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
  if (!n) return <Loading />;
  const src = SOURCES[n.source || 'reporter'] || SOURCES.reporter;
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Card accent>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <Badge text={STATUS[n.status]?.label} color={STATUS[n.status]?.color} />
          <Badge text={src.label} color={src.color} />
        </View>
        <Text style={s.title}>{n.title}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <Meta icon="location-outline" text={[n.constituency, n.district].filter(Boolean).join(', ')} />
          <Meta icon="person-outline" text={n.author?.name} />
        </View>
        {(n.highlights || []).length ? (
          <View style={s.highlights}>
            {n.highlights.map((h, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 6, marginVertical: 2 }}>
                <Icon name="caret-forward" size={14} color="#fff" style={{ marginTop: 3 }} />
                <Text style={s.hl}>{h}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {(n.images || []).length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }}>
            {n.images.map(u => <Image key={u} source={{ uri: u }} style={s.photo} />)}
          </ScrollView>
        ) : null}
        <Text style={s.body}>{n.body}</Text>
      </Card>

      {n.status !== 'published' ? (
        <Card>
          <SectionTitle icon="chatbox-ellipses-outline" title="Your decision" sub="Approve it for the e-paper, or send it back with a note" />
          <Field label="Note to reporter" hint="Needed when sending it back" value={note} onChangeText={setNote} multiline style={{ minHeight: 70 }} />
          <View style={{ gap: 10 }}>
            <Button title="Approve for e-paper" icon="checkmark-circle-outline" onPress={() => review('approve')} loading={busy} />
            <Button title="Send back to reporter" icon="arrow-undo-outline" kind="danger" onPress={() => review('reject')} disabled={busy} />
            <Button title="Edit text or photos" icon="create-outline" kind="secondary" onPress={() => navigation.replace('NewsEditor', { id })} disabled={busy} />
          </View>
        </Card>
      ) : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 22, lineHeight: 32, fontWeight: '800', color: C.red, marginTop: 12, marginBottom: 8 },
  highlights: { backgroundColor: C.pink, padding: 12, borderRadius: 10, marginTop: 12 },
  hl: { flex: 1, color: '#fff', fontWeight: '700', lineHeight: 21 },
  photo: { width: 260, height: 180, borderRadius: 10, marginRight: 8 },
  body: { fontSize: 17, lineHeight: 29, color: C.ink, marginTop: 14 },
});
