import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../auth';
import { api, errMsg, uploadImages } from '../api';
import { SECTIONS, MAX_IMAGES, stateOf } from '../constants';
import PlacePicker from '../PlacePicker';
import { Button, Chips, Field, C } from '../ui';

const EDITABLE_BY_REPORTER = ['draft', 'submitted', 'rejected'];

export default function NewsEditorScreen({ navigation, route }) {
  const id = route.params?.id;
  const { user, can } = useAuth();
  const [f, setF] = useState({ title: '', highlights: '', body: '', section: 'constituency',
    state: user.state || stateOf(user.district) || 'ఆంధ్రప్రదేశ్', district: user.district || '', constituency: user.constituency || '', dateline: '' });
  const [images, setImages] = useState([]);   // { uri, remote: bool, ... }
  const [status, setStatus] = useState('draft');
  const [ownerId, setOwnerId] = useState(user.id);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!!id);

  useEffect(() => { if (id) (async () => {
    try {
      const { news: n } = (await api.get(`/news/${id}`)).data;
      setF({ title: n.title, highlights: (n.highlights || []).join('\n'), body: n.body, section: n.section,
        state: n.state || stateOf(n.district) || 'ఆంధ్రప్రదేశ్', district: n.district || '', constituency: n.constituency || '', dateline: n.dateline || '' });
      setImages((n.images || []).map(uri => ({ uri, remote: true })));
      setStatus(n.status); setOwnerId(n.author?._id);
    } catch (e) { Alert.alert('Could not open', errMsg(e)); navigation.goBack(); } finally { setLoading(false); }
  })(); }, [id]);

  // Reporters may only change their own cards before approval (the server checks this too).
  const locked = !can.review && (ownerId !== user.id || !EDITABLE_BY_REPORTER.includes(status));
  const set = k => v => setF(s => ({ ...s, [k]: v }));

  const pick = async (camera) => {
    const room = MAX_IMAGES - images.length;
    if (room <= 0) return Alert.alert('Photo limit reached', `A news card can have up to ${MAX_IMAGES} photos.`);
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed', 'Allow photo access in your phone settings to add pictures.');
    const opts = { mediaTypes: ['images'], quality: 0.6, allowsMultipleSelection: !camera, selectionLimit: room };
    const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!r.canceled) setImages(s => [...s, ...r.assets.slice(0, room)]);
  };

  const save = async submit => {
    if (!f.title.trim() || !f.body.trim()) return Alert.alert('Missing details', 'Add a headline and the news text.');
    if (!f.district) return Alert.alert('Missing details', 'Choose the district for this news.');
    setBusy(true);
    try {
      const uploaded = await uploadImages(images.filter(i => !i.remote));
      let k = 0;
      const urls = images.map(i => (i.remote ? i.uri : uploaded[k++]));
      const payload = { ...f, highlights: f.highlights.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 5),
        dateline: f.dateline || f.constituency || f.district, images: urls, submit };
      if (id) await api.patch(`/news/${id}`, payload); else await api.post('/news', payload);
      navigation.goBack();
    } catch (e) { Alert.alert('Not saved', errMsg(e)); } finally { setBusy(false); }
  };

  const remove = () => Alert.alert('Delete this news card?', 'This cannot be undone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      try { await api.delete(`/news/${id}`); navigation.goBack(); } catch (e) { Alert.alert('Not deleted', errMsg(e)); } } },
  ]);

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color={C.red} />;
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      {locked ? <Text style={{ backgroundColor: '#FFF4E5', padding: 10, borderRadius: 8, marginBottom: 12, color: '#8A4B00' }}>
        This news is {status}. Only an editor can change it now.</Text> : null}
      <Field label="Headline" value={f.title} onChangeText={set('title')} editable={!locked} />
      <Field label="Highlights (one per line, up to 5)" value={f.highlights} onChangeText={set('highlights')} multiline editable={!locked} style={{ minHeight: 80 }} />

      <Text style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>Photos ({images.length}/{MAX_IMAGES})</Text>
      <ScrollView horizontal style={{ marginBottom: 8 }}>
        {images.map((im, i) => (
          <View key={im.uri + i} style={{ marginRight: 8 }}>
            <Image source={{ uri: im.uri }} style={{ width: 96, height: 72, borderRadius: 8 }} />
            {!locked ? <Pressable onPress={() => setImages(s => s.filter((_, j) => j !== i))} hitSlop={8}
              style={{ position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(0,0,0,.65)', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>✕</Text></Pressable> : null}
          </View>
        ))}
      </ScrollView>
      {!locked ? <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        <Button title="Gallery" kind="secondary" onPress={() => pick(false)} style={{ flex: 1 }} />
        <Button title="Camera" kind="secondary" onPress={() => pick(true)} style={{ flex: 1 }} />
      </View> : null}

      <Field label="News text" value={f.body} onChangeText={set('body')} multiline editable={!locked} style={{ minHeight: 200 }} />
      <Chips label="Section" options={Object.entries(SECTIONS)} value={f.section} onChange={locked ? () => {} : set('section')} />
      <PlacePicker value={f} disabled={locked} onChange={p => setF(s => ({ ...s, ...p }))} />
      <Field label="Dateline place (optional)" value={f.dateline} onChangeText={set('dateline')} placeholder={f.constituency || 'e.g. నరసరావుపేట'} editable={!locked} />

      {!locked ? <>
        <Button title={busy ? 'Saving…' : can.review ? 'Save and approve' : 'Submit for review'} onPress={() => save(true)} disabled={busy} />
        <Button title="Save as draft" kind="secondary" onPress={() => save(false)} disabled={busy} style={{ marginTop: 10 }} />
        {id ? <Button title="Delete" kind="danger" onPress={remove} disabled={busy} style={{ marginTop: 10 }} /> : null}
      </> : null}
    </ScrollView>
  );
}
