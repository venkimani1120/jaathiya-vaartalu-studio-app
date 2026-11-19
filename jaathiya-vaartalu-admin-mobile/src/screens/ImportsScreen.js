import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { api, errMsg } from '../api';
import { EDITION_TYPES, STATES, STATE_NAMES } from '../constants';
import { Badge, Banner, Button, C, Card, Chips, EmptyState, Field, Icon, Meta, SectionTitle } from '../ui';

// Same rules as the web app's Imports page and the server (POST /api/imports).
const MAX_PAGES = 40;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PAPER_STATUS = { processing: ['Storing pages…', '#B45309'], ready: ['Pages ready', C.blue], failed: ['Failed', C.warn] };
const iso = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const DATES = [[iso(Date.now()), 'Today'], [iso(Date.now() - 864e5), 'Yesterday'], [iso(Date.now() - 2 * 864e5), '2 days ago']];
const blank = () => ({ publisher: '', editionName: '', editionDate: iso(Date.now()), editionType: 'district', state: '', district: '' });
const typeOf = f => f.mimeType || (/\.pdf$/i.test(f.name || f.uri) ? 'application/pdf' : /\.png$/i.test(f.name || f.uri) ? 'image/png' : 'image/jpeg');
const nameOf = (f, i) => f.name || f.fileName || `page-${String(i + 1).padStart(2, '0')}.jpg`;

// Editors and admins: upload another paper's e-paper (one PDF, or page photos in order) for news extraction,
// then open it to choose which of its news goes to the feed.
export default function ImportsScreen({ navigation }) {
  const [form, setForm] = useState(blank);
  const [files, setFiles] = useState([]);   // { uri, name, mimeType, size }
  const [names, setNames] = useState({ publishers: [], editions: [] });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems((await api.get('/imports', { params: { limit: 50 } })).data.items); setListError(''); }
    catch (e) { setListError(errMsg(e)); } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { api.get('/imports/publishers').then(r => setNames(r.data)).catch(() => {}); }, []);
  // While pages are being stored, refresh the list every few seconds.
  const working = items.some(p => p.status === 'processing');
  useEffect(() => { if (!working) return; const t = setInterval(load, 5000); return () => clearInterval(t); }, [working, load]);

  const set = k => v => setForm(f => ({ ...f, [k]: v }));
  const pdf = files.find(f => typeOf(f) === 'application/pdf');

  const pickPdf = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (!r.canceled) { setFiles(r.assets.slice(0, 1)); setError(''); }
  };
  const pickImages = async camera => {
    const room = MAX_PAGES - (pdf ? 0 : files.length);
    if (room <= 0) return Alert.alert('Page limit reached', `Up to ${MAX_PAGES} page images.`);
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed', 'Allow photo access in your phone settings to add pages.');
    // Full quality: pages are kept at their original size so small print can be read.
    // Compatible: iPhones hand over JPEG instead of HEIC (the server takes JPG, PNG and WebP pages).
    const opts = { mediaTypes: ['images'], quality: 1, allowsMultipleSelection: !camera, selectionLimit: room, orderedSelection: true,
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible };
    const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (r.canceled) return;
    const picked = r.assets.filter(a => IMAGE_TYPES.includes(typeOf(a))).slice(0, room);
    if (picked.length < r.assets.length) Alert.alert('Some photos skipped', 'Only JPG, PNG and WebP images can be uploaded.');
    setFiles(fs => [...(pdf ? [] : fs), ...picked]); setError('');
  };
  const move = (i, d) => setFiles(fs => { const t = [...fs], j = i + d; if (j < 0 || j >= t.length) return fs; [t[i], t[j]] = [t[j], t[i]]; return t; });

  const ready = form.publisher.trim() && form.editionName.trim() && /^\d{4}-\d{2}-\d{2}$/.test(form.editionDate) && files.length;
  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true); setError('');
    const body = new FormData();
    ['publisher', 'editionName', 'editionDate', 'editionType', 'district'].forEach(k => form[k] && body.append(k, form[k].trim()));
    if (pdf) body.append('file', { uri: pdf.uri, name: nameOf(pdf, 0), type: 'application/pdf' });
    else files.forEach((f, i) => body.append('pages', { uri: f.uri, name: nameOf(f, i), type: typeOf(f) }));
    try {
      const { paper } = (await api.post('/imports', body, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 600000 })).data;
      setForm(blank()); setFiles([]);
      navigation.navigate('ImportPaper', { id: paper._id, title: `${paper.publisher} – ${paper.editionName}` });
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };

  const suggest = (list, k) => (list.length ? <Chips options={list.slice(0, 20).map(n => [n, n])} value={form[k]} onChange={set(k)} /> : null);
  const districts = form.state ? Object.keys(STATES[form.state]) : [];

  const header = (
    <View>
      <Card>
        <SectionTitle icon="cloud-upload-outline" title="Upload a newspaper" sub="One PDF of the whole edition, or page photos in page order" />
        <Field label="Paper" value={form.publisher} onChangeText={set('publisher')} placeholder="e.g. Eenadu" maxLength={80} icon="newspaper-outline" />
        {suggest(names.publishers, 'publisher')}
        <Field label="Edition" value={form.editionName} onChangeText={set('editionName')} placeholder="e.g. Guntur" maxLength={80} icon="albums-outline" />
        {suggest(names.editions, 'editionName')}
        <Chips label="Date on the paper" options={DATES} value={form.editionDate} onChange={set('editionDate')} icon="calendar-outline" />
        <Field value={form.editionDate} onChangeText={set('editionDate')} placeholder="YYYY-MM-DD" hint="Or type another date, like 2026-11-05." maxLength={10} />
        <Chips label="Edition type" options={Object.entries(EDITION_TYPES)} value={form.editionType} onChange={set('editionType')} />
        <Chips label="State (optional)" options={[['', '–'], ...STATE_NAMES.map(n => [n, n])]} value={form.state} onChange={v => setForm(f => ({ ...f, state: v, district: '' }))} />
        {form.state ? <Chips label="District (optional)" options={[['', '–'], ...districts.map(d => [d, d])]} value={form.district} onChange={set('district')} /> : null}

        <Text style={s.label}>File</Text>
        <View style={s.pickRow}>
          <Button title="PDF" icon="document-outline" kind="secondary" small onPress={pickPdf} disabled={busy} style={{ flex: 1 }} />
          <Button title="Gallery" icon="images-outline" kind="secondary" small onPress={() => pickImages(false)} disabled={busy} style={{ flex: 1 }} />
          <Button title="Camera" icon="camera-outline" kind="secondary" small onPress={() => pickImages(true)} disabled={busy} style={{ flex: 1 }} />
        </View>
        {pdf ? (
          <View style={s.file}>
            <Icon name="document-text-outline" size={22} color={C.blue} />
            <Text style={s.fileName} numberOfLines={1}>{pdf.name}{pdf.size ? ` · ${(pdf.size / 1048576).toFixed(1)} MB` : ''}</Text>
            <Pressable onPress={() => setFiles([])} hitSlop={8} accessibilityLabel="Remove the PDF"><Icon name="close" size={20} color={C.muted} /></Pressable>
          </View>
        ) : files.length ? (
          <View>
            <Text style={s.hint}>{files.length} page{files.length === 1 ? '' : 's'}, in this order. Use the arrows to reorder.</Text>
            <View style={s.grid}>
              {files.map((f, i) => (
                <View key={f.uri + i} style={s.cell}>
                  <Image source={{ uri: f.uri }} style={s.photo} />
                  <Text style={s.pageNo}>{i + 1}</Text>
                  <Pressable onPress={() => setFiles(x => x.filter((_, j) => j !== i))} hitSlop={8} style={s.remove} accessibilityLabel={`Remove page ${i + 1}`}>
                    <Icon name="close" size={14} color="#fff" /></Pressable>
                  <View style={s.arrows}>
                    {i > 0 ? <Pressable onPress={() => move(i, -1)} hitSlop={6} accessibilityLabel={`Move page ${i + 1} earlier`}><Icon name="chevron-back" size={18} color="#fff" /></Pressable> : <View />}
                    {i < files.length - 1 ? <Pressable onPress={() => move(i, 1)} hitSlop={6} accessibilityLabel={`Move page ${i + 1} later`}><Icon name="chevron-forward" size={18} color="#fff" /></Pressable> : null}
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : <Text style={s.hint}>Pages are kept at their original size. Up to {MAX_PAGES} page photos.</Text>}

        {error ? <Banner kind="error" style={{ marginTop: 12 }}>{error}</Banner> : null}
        <Button title={busy ? 'Uploading…' : 'Upload'} icon="cloud-upload-outline" onPress={submit} disabled={!ready} loading={busy} style={{ marginTop: 14 }} />
      </Card>
      {listError ? <Banner kind="error">{listError}</Banner> : null}
      {items.length ? <Text style={s.heading}>Imported papers</Text> : null}
    </View>
  );

  return (
    <FlatList style={{ backgroundColor: C.bg }} data={items} keyExtractor={p => p._id} ListHeaderComponent={header}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={[C.blue]} tintColor={C.blue} />}
      ListEmptyComponent={!loading && !listError ? <EmptyState icon="newspaper-outline" title="No imported papers yet" text="Upload one above to start." /> : null}
      renderItem={({ item: p }) => {
        const ok = p.pages.filter(x => x.status === 'ready').length;
        const [label, color] = PAPER_STATUS[p.status] || [p.status, C.muted];
        return (
          <Pressable onPress={() => navigation.navigate('ImportPaper', { id: p._id, title: `${p.publisher} – ${p.editionName}` })} accessibilityRole="button">
            <Card style={s.row}>
              <View style={s.edIcon}><Icon name="reader-outline" size={22} color={C.blue} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.title} numberOfLines={2}>{p.publisher} – {p.editionName}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 6 }}>
                  <Meta icon="calendar-outline" text={p.editionDate.slice(0, 10)} />
                  <Meta icon="documents-outline" text={ok === p.pages.length ? `${ok} pages` : `${ok} / ${p.pages.length} pages`} />
                  <Meta icon="list-outline" text={`${p.pages.reduce((a, x) => a + (x.articles || 0), 0)} news`} />
                </View>
                <Badge text={label} color={color} />
              </View>
              <Icon name="chevron-forward" size={18} color={C.faint} style={{ alignSelf: 'center' }} />
            </Card>
          </Pressable>
        );
      }} />
  );
}

const s = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: C.ink, marginBottom: 6 },
  hint: { fontSize: 12, color: C.muted, marginTop: 8, lineHeight: 17 },
  pickRow: { flexDirection: 'row', gap: 8 },
  file: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: C.blueSoft },
  fileName: { flex: 1, color: C.ink, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  cell: { width: '31.5%', aspectRatio: 3 / 4, borderRadius: 10, overflow: 'hidden', backgroundColor: C.bg },
  photo: { width: '100%', height: '100%' },
  pageNo: { position: 'absolute', left: 4, top: 4, color: '#fff', fontSize: 11, fontWeight: '800', backgroundColor: 'rgba(0,0,0,.6)',
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  remove: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,.65)', alignItems: 'center', justifyContent: 'center' },
  arrows: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, paddingVertical: 4, backgroundColor: 'rgba(0,0,0,.45)' },
  heading: { fontSize: 13, fontWeight: '800', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 12 },
  edIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '700', color: C.ink },
});
