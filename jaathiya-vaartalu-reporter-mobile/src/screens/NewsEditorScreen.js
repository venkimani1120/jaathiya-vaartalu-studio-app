import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../auth';
import { api, errMsg, uploadImages } from '../api';
import { SECTIONS, MAX_IMAGES, STATUS, stateOf } from '../constants';
import PlacePicker from '../PlacePicker';
import { Banner, Button, C, Card, Chips, Field, Icon, Loading, SectionTitle } from '../ui';

const EDITABLE_BY_REPORTER = ['draft', 'submitted', 'rejected'];

export default function NewsEditorScreen({ navigation, route }) {
  const id = route.params?.id;
  const { user } = useAuth();
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
  const locked = ownerId !== user.id || !EDITABLE_BY_REPORTER.includes(status);
  const set = k => v => setF(s => ({ ...s, [k]: v }));

  const pick = async (camera) => {
    const room = MAX_IMAGES - images.length;
    if (room <= 0) return Alert.alert('Photo limit reached', `A news card can have up to ${MAX_IMAGES} photos.`);
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed', 'Allow photo access in your phone settings to add pictures.');
    // Compatible: iPhones hand over JPEG instead of HEIC, which browsers and the web app can't show.
    const opts = { mediaTypes: ['images'], quality: 0.6, allowsMultipleSelection: !camera, selectionLimit: room, preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible };
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

  if (loading) return <Loading />;
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      {locked ? <Banner kind="warn" icon="lock-closed">This news is {STATUS[status]?.label.toLowerCase() || status}. Only an editor can change it now.</Banner> : null}

      <Card>
        <SectionTitle icon="document-text-outline" title="Story" sub="Headline, key points and the full text" />
        <Field label="Headline" value={f.title} onChangeText={set('title')} editable={!locked} placeholder="Write a clear headline" />
        <Field label="Highlights" hint="One per line, up to 5" value={f.highlights} onChangeText={set('highlights')} multiline editable={!locked} style={{ minHeight: 70 }} />
        <Field label="News text" value={f.body} onChangeText={set('body')} multiline editable={!locked} style={{ minHeight: 180 }} />
      </Card>

      <Card>
        <SectionTitle icon="images-outline" title="Photos" sub={`${images.length} of ${MAX_IMAGES} added`} />
        <View style={s.grid}>
          {images.map((im, i) => (
            <View key={im.uri + i} style={s.cell}>
              <Image source={{ uri: im.uri }} style={s.photo} />
              {i === 0 ? <Text style={s.cover}>Cover</Text> : null}
              {!locked ? <Pressable onPress={() => setImages(x => x.filter((_, j) => j !== i))} hitSlop={8} style={s.remove}
                accessibilityRole="button" accessibilityLabel={`Remove photo ${i + 1}`}>
                <Icon name="close" size={16} color="#fff" /></Pressable> : null}
            </View>
          ))}
          {!locked && images.length < MAX_IMAGES ? <>
            <Pressable onPress={() => pick(false)} style={[s.cell, s.add]} accessibilityRole="button">
              <Icon name="images-outline" size={24} color={C.blue} /><Text style={s.addText}>Gallery</Text></Pressable>
            <Pressable onPress={() => pick(true)} style={[s.cell, s.add]} accessibilityRole="button">
              <Icon name="camera-outline" size={24} color={C.blue} /><Text style={s.addText}>Camera</Text></Pressable>
          </> : null}
        </View>
        {!images.length && locked ? <Text style={{ color: C.muted }}>No photos.</Text> : null}
      </Card>

      <Card>
        <SectionTitle icon="location-outline" title="Section and place" sub="Where this news belongs in the paper" />
        <Chips label="Section" options={Object.entries(SECTIONS)} value={f.section} onChange={locked ? () => {} : set('section')} />
        <PlacePicker value={f} disabled={locked} onChange={p => setF(x => ({ ...x, ...p }))} />
        <Field label="Dateline place" hint="Optional. Shown before the text." value={f.dateline} onChangeText={set('dateline')}
          placeholder={f.constituency || 'e.g. నరసరావుపేట'} editable={!locked} icon="pin-outline" />
      </Card>

      {!locked ? <View style={{ gap: 10, marginTop: 4 }}>
        <Button title="Submit for review" icon="send-outline" onPress={() => save(true)} loading={busy} />
        <Button title="Save as draft" icon="save-outline" kind="secondary" onPress={() => save(false)} disabled={busy} />
        {id ? <Button title="Delete" icon="trash-outline" kind="danger" onPress={remove} disabled={busy} /> : null}
      </View> : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '31.5%', aspectRatio: 4 / 3, borderRadius: 10, overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  cover: { position: 'absolute', left: 4, bottom: 4, color: '#fff', fontSize: 10, fontWeight: '700', backgroundColor: 'rgba(0,0,0,.6)',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  remove: { position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,.65)', alignItems: 'center', justifyContent: 'center' },
  add: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.blue, backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center' },
  addText: { fontSize: 12, fontWeight: '700', color: C.blue, marginTop: 4 },
});
