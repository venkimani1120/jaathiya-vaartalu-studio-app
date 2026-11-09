import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../auth';
import { api, errMsg, uploadImages } from '../api';
import { SECTIONS, MAX_IMAGES, stateOf } from '../constants';
import PlacePicker from '../PlacePicker';
import { Banner, Button, C, Card, Chips, Field, Icon, Loading, SectionTitle } from '../ui';

// A small news cut: a photo of the cutting (cropped on the phone) plus its headline and text, saved as a
// news card the same way the web app's "New news card" does. Editors' and admins' saved cards go straight to the
// approved pool, so the cut is ready to place in the layout studio.
export default function NewsCutScreen({ navigation, route }) {
  const id = route.params?.id;
  const { user } = useAuth();
  const [f, setF] = useState({ title: '', highlights: '', body: '', section: 'constituency',
    state: user.state || stateOf(user.district) || 'ఆంధ్రప్రదేశ్', district: user.district || '', constituency: user.constituency || '', dateline: '' });
  const [images, setImages] = useState([]);   // { uri, remote: bool, ... }; the first is the cut
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!!id);

  useEffect(() => { if (id) (async () => {
    try {
      const { news: n } = (await api.get(`/news/${id}`)).data;
      setF({ title: n.title, highlights: (n.highlights || []).join('\n'), body: n.body, section: n.section,
        state: n.state || stateOf(n.district) || 'ఆంధ్రప్రదేశ్', district: n.district || '', constituency: n.constituency || '', dateline: n.dateline || '' });
      setImages((n.images || []).map(uri => ({ uri, remote: true })));
    } catch (e) { Alert.alert('Could not open', errMsg(e)); navigation.goBack(); } finally { setLoading(false); }
  })(); }, [id]);

  const set = k => v => setF(s => ({ ...s, [k]: v }));

  // cut: one photo with the phone's crop tool, put first. Otherwise extra photos (several from the gallery).
  const pick = async (camera, cut) => {
    const room = MAX_IMAGES - images.length;
    if (room <= 0) return Alert.alert('Photo limit reached', `A news card can have up to ${MAX_IMAGES} photos.`);
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed', 'Allow photo access in your phone settings to add pictures.');
    // Compatible: iPhones hand over JPEG instead of HEIC, which browsers and the web app can't show.
    const opts = cut ? { mediaTypes: ['images'], quality: 0.8, allowsEditing: true, preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible }
      : { mediaTypes: ['images'], quality: 0.6, allowsMultipleSelection: !camera, selectionLimit: room, preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible };
    const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (r.canceled) return;
    setImages(s => (cut ? [r.assets[0], ...s] : [...s, ...r.assets.slice(0, room)]));
  };

  const save = async submit => {
    if (!images.length) return Alert.alert('Missing details', 'Add the photo of the news cut.');
    if (!f.title.trim() || !f.body.trim()) return Alert.alert('Missing details', 'Add the headline and the news text from the cut.');
    if (!f.district) return Alert.alert('Missing details', 'Choose the district for this news.');
    setBusy(true);
    try {
      const uploaded = await uploadImages(images.filter(i => !i.remote));
      let k = 0;
      const urls = images.map(i => (i.remote ? i.uri : uploaded[k++]));
      const payload = { ...f, highlights: f.highlights.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 5),
        dateline: f.dateline || f.constituency || f.district, images: urls, submit };
      if (id) await api.patch(`/news/${id}`, payload); else await api.post('/news', payload);
      Alert.alert('Saved', submit ? 'The news cut is approved and ready in the layout studio.' : 'Saved as a draft.');
      navigation.goBack();
    } catch (e) { Alert.alert('Not saved', errMsg(e)); } finally { setBusy(false); }
  };

  if (loading) return <Loading />;
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Card>
        <SectionTitle icon="cut-outline" title="News cut" sub="Photograph or pick the cutting, then crop it to the story" />
        {images[0] ? (
          <View>
            <Image source={{ uri: images[0].uri }} style={s.cut} resizeMode="contain" />
            <Pressable onPress={() => setImages(x => x.slice(1))} hitSlop={8} style={s.remove} accessibilityRole="button" accessibilityLabel="Remove the cut">
              <Icon name="close" size={16} color="#fff" /></Pressable>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="Camera" icon="camera-outline" kind="secondary" onPress={() => pick(true, true)} style={{ flex: 1 }} />
            <Button title="Gallery" icon="images-outline" kind="secondary" onPress={() => pick(false, true)} style={{ flex: 1 }} />
          </View>
        )}
      </Card>

      <Card>
        <SectionTitle icon="document-text-outline" title="Story" sub="Type the headline and text from the cut" />
        <Field label="Headline" value={f.title} onChangeText={set('title')} placeholder="Headline of the cut" />
        <Field label="Highlights" hint="One per line, up to 5" value={f.highlights} onChangeText={set('highlights')} multiline style={{ minHeight: 70 }} />
        <Field label="News text" value={f.body} onChangeText={set('body')} multiline style={{ minHeight: 160 }} />
      </Card>

      {images.length ? (
        <Card>
          <SectionTitle icon="images-outline" title="More photos" sub={`Optional · ${images.length} of ${MAX_IMAGES} photos with the cut`} />
          <View style={s.grid}>
            {images.slice(1).map((im, i) => (
              <View key={im.uri + i} style={s.cell}>
                <Image source={{ uri: im.uri }} style={s.photo} />
                <Pressable onPress={() => setImages(x => x.filter((_, j) => j !== i + 1))} hitSlop={8} style={s.remove}
                  accessibilityRole="button" accessibilityLabel={`Remove photo ${i + 2}`}>
                  <Icon name="close" size={16} color="#fff" /></Pressable>
              </View>
            ))}
            {images.length < MAX_IMAGES ? <>
              <Pressable onPress={() => pick(false, false)} style={[s.cell, s.add]} accessibilityRole="button">
                <Icon name="images-outline" size={24} color={C.blue} /><Text style={s.addText}>Gallery</Text></Pressable>
              <Pressable onPress={() => pick(true, false)} style={[s.cell, s.add]} accessibilityRole="button">
                <Icon name="camera-outline" size={24} color={C.blue} /><Text style={s.addText}>Camera</Text></Pressable>
            </> : null}
          </View>
        </Card>
      ) : null}

      <Card>
        <SectionTitle icon="location-outline" title="Section and place" sub="Where this news belongs in the paper" />
        <Chips label="Section" options={Object.entries(SECTIONS)} value={f.section} onChange={set('section')} />
        <PlacePicker value={f} onChange={p => setF(x => ({ ...x, ...p }))} />
        <Field label="Dateline place" hint="Optional. Shown before the text." value={f.dateline} onChangeText={set('dateline')}
          placeholder={f.constituency || 'e.g. నరసరావుపేట'} icon="pin-outline" />
      </Card>

      <Banner kind="info">Saved news cuts are approved straight away and show in the layout studio's news list.</Banner>
      <View style={{ gap: 10, marginTop: 4 }}>
        <Button title="Save and approve" icon="checkmark-circle-outline" onPress={() => save(true)} loading={busy} />
        <Button title="Save as draft" icon="save-outline" kind="secondary" onPress={() => save(false)} disabled={busy} />
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  cut: { width: '100%', height: 260, borderRadius: 12, backgroundColor: C.bg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '31.5%', aspectRatio: 4 / 3, borderRadius: 10, overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  remove: { position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,.65)', alignItems: 'center', justifyContent: 'center' },
  add: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.blue, backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center' },
  addText: { fontSize: 12, fontWeight: '700', color: C.blue, marginTop: 4 },
});
