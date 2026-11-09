import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, errMsg } from '../api';
import { STATUS } from '../constants';
import { Badge, Banner, Button, C, Card, Icon, Loading, SectionTitle } from '../ui';

// Adds a Cloudinary transformation after the ones already in the URL (as the web app does). Local files: unchanged.
const cld = (url, t) => (!url.includes('/image/upload/') ? url
  : /\/v\d+\//.test(url) ? url.replace(/\/(v\d+\/)/, `/${t}/$1`) : url.replace('/image/upload/', `/image/upload/${t}/`));
const thumb = url => cld(url, 'w_360,c_limit,f_auto,q_auto');
const EXTRACT = { pending: 'Waiting to be read', running: 'Reading…', done: 'Read', failed: 'Could not read' };

// One imported paper: its pages, and the news read from each page. The desk ticks the news worth
// using and adds it to the feed (for review), or deletes what isn't needed. Same as the web app's import page.
export default function ImportPaperScreen({ navigation, route }) {
  const { id } = route.params;
  const [paper, setPaper] = useState(null);
  const [news, setNews] = useState([]);
  const [extraction, setExtraction] = useState(null);
  const [picked, setPicked] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const { bottom } = useSafeAreaInsets();

  const load = useCallback(async () => {
    try {
      const [p, n] = await Promise.all([api.get(`/imports/${id}`), api.get('/news', { params: { paper: id, limit: 300 } })]);
      setPaper(p.data.paper); setNews(n.data.items); setError('');
      return p.data.paper;
    } catch (e) { setError(errMsg(e)); return null; }
  }, [id]);
  useEffect(() => { api.get('/imports/status').then(r => setExtraction(r.data.extraction)).catch(() => {}); }, []);
  // Keep refreshing while pages are being stored or read.
  useEffect(() => {
    let live = true, timer;
    const tick = async () => {
      const p = await load();
      if (!live || !p) return;
      const reading = p.pages.some(x => x.status === 'ready' && x.extract !== 'done' && x.extract !== 'failed');
      if (p.status === 'processing' || reading) timer = setTimeout(tick, 5000);
    };
    tick();
    return () => { live = false; clearTimeout(timer); };
  }, [load]);

  if (!paper) return error ? <View style={{ flex: 1, backgroundColor: C.bg, padding: 16 }}><Banner kind="error">{error}</Banner></View> : <Loading />;

  const ready = paper.pages.filter(p => p.status === 'ready');
  const read = ready.filter(p => p.extract === 'done').length;
  const onPage = no => news.filter(n => n.sourceRef?.page === no);
  const pickable = news.filter(n => n.status === 'imported');
  const chosen = pickable.filter(n => picked.has(n._id));
  const toggle = nid => setPicked(s => { const t = new Set(s); t.has(nid) ? t.delete(nid) : t.add(nid); return t; });
  const toggleAll = () => setPicked(s => (pickable.every(n => s.has(n._id)) ? new Set() : new Set(pickable.map(n => n._id))));

  const act = async action => {
    const ids = chosen.map(n => n._id);
    if (!ids.length) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const r = (await api.post(`/imports/${id}/news`, { ids, action })).data;
      setPicked(new Set()); await load();
      setNotice(action === 'add' ? `Added ${r.added} to the news feed, waiting for review.` : `Deleted ${r.deleted}.`);
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };
  const confirmDelete = () => Alert.alert(`Delete ${chosen.length} news?`, 'News read from this paper is deleted for good.', [
    { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => act('delete') }]);

  const readAgain = no => Alert.alert(`Read ${no ? `page ${no}` : 'every page'} again?`,
    'News that is not in the feed, waiting for review or sent back is replaced. Approved news is kept.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Read again', onPress: async () => {
        setBusy(true); setError('');
        try { await api.post(`/imports/${id}/extract`, null, { params: no ? { page: no } : undefined }); await load(); }
        catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
      } }]);

  const remove = () => Alert.alert('Delete this paper?', `${paper.publisher} – ${paper.editionName}, its page images and its news that is not approved yet.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      try { await api.delete(`/imports/${id}`); navigation.goBack(); } catch (e) { setError(errMsg(e)); }
    } }]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: chosen.length ? 120 : 40 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} colors={[C.blue]} tintColor={C.blue} />}>
        <Card>
          <Text style={s.title}>{paper.publisher} – {paper.editionName}</Text>
          <Text style={s.sub}>{paper.editionDate.slice(0, 10)}{paper.district ? ` · ${paper.district}` : ''} · {paper.fileKind === 'pdf' ? 'PDF' : 'page images'}</Text>
          <View style={s.stats}>
            <Text style={s.stat}><Text style={s.b}>{ready.length}</Text> of {paper.pages.length} pages stored</Text>
            {extraction?.enabled ? <Text style={s.stat}><Text style={s.b}>{read}</Text> of {ready.length} read</Text> : null}
            <Text style={s.stat}><Text style={s.b}>{news.length}</Text> news found</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            {extraction?.enabled && ready.length ? <Button title="Read all again" icon="refresh" kind="secondary" small onPress={() => readAgain(null)} disabled={busy} style={{ flex: 1 }} /> : null}
            <Button title="Delete" icon="trash-outline" kind="danger" small onPress={remove} disabled={busy || paper.status === 'processing'} style={{ flex: 1 }} />
          </View>
        </Card>
        {paper.status === 'processing' ? <Banner kind="info">Storing pages: {paper.pages.filter(p => p.status !== 'pending').length} of {paper.pages.length} done. You can leave this screen; it carries on.</Banner> : null}
        {paper.error ? <Banner kind="error">{paper.error}</Banner> : null}
        {extraction && !extraction.enabled ? <Banner kind="warn">News extraction is off on the server (GEMINI_API_KEY is not set), so these pages are not read.</Banner> : null}
        {error ? <Banner kind="error">{error}</Banner> : null}
        {notice ? <Banner kind="info">{notice}</Banner> : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {paper.pages.map(p => (
            <Pressable key={p.no} onPress={() => p.imageUrl && Linking.openURL(p.imageUrl)} style={s.page} accessibilityLabel={`Open page ${p.no}`}>
              {p.status === 'ready' ? <Image source={{ uri: thumb(p.imageUrl) }} style={s.pageImg} resizeMode="cover" />
                : <View style={[s.pageImg, s.pageEmpty]}><Text style={s.sub}>{p.status === 'pending' ? 'Storing…' : 'Failed'}</Text></View>}
              <Text style={s.pageCap}>Page {p.no}</Text>
              {p.status === 'ready' && extraction?.enabled ? <Text style={s.pageX} numberOfLines={1}>
                {p.extract === 'done' ? `${p.articles || 0} news` : EXTRACT[p.extract || 'pending']}</Text> : null}
            </Pressable>
          ))}
        </ScrollView>

        {news.length ? (
          <Card>
            <SectionTitle icon="list-outline" title="News found" sub="Tick the news worth using and add it to the feed"
              right={pickable.length ? <Button title={pickable.every(n => picked.has(n._id)) ? 'Clear' : 'Select all'} kind="ghost" small onPress={toggleAll} disabled={busy} /> : null} />
            {ready.filter(p => onPage(p.no).length).map(p => (
              <View key={p.no} style={{ marginBottom: 10 }}>
                <View style={s.pageHead}>
                  <Text style={s.b}>Page {p.no}</Text>
                  {extraction?.enabled ? <Pressable onPress={() => readAgain(p.no)} disabled={busy || p.extract === 'running'} hitSlop={8}>
                    <Text style={s.link}>Read again</Text></Pressable> : null}
                </View>
                {onPage(p.no).map(n => {
                  const can = n.status === 'imported', on = picked.has(n._id);
                  return (
                    <Pressable key={n._id} onPress={() => can && toggle(n._id)} disabled={!can || busy} style={[s.item, on && s.itemOn]}
                      accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: !can }}>
                      <Icon name={can ? (on ? 'checkbox' : 'square-outline') : 'remove-outline'} size={22} color={can ? C.blue : C.faint} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.itemTitle} numberOfLines={3}>{n.title}</Text>
                        <Badge text={STATUS[n.status]?.label || n.status} color={STATUS[n.status]?.color} />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </Card>
        ) : null}
      </ScrollView>

      {chosen.length ? (
        <View style={[s.bar, { paddingBottom: 16 + bottom }]}>
          <Button title={`Delete ${chosen.length}`} icon="trash-outline" kind="danger" onPress={confirmDelete} disabled={busy} style={{ flex: 1 }} />
          <Button title={`Add ${chosen.length} to feed`} icon="add-circle-outline" onPress={() => act('add')} loading={busy} style={{ flex: 1.4 }} />
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '800', color: C.ink },
  sub: { fontSize: 13, color: C.muted, marginTop: 4 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  stat: { fontSize: 13, color: C.muted },
  b: { fontWeight: '800', color: C.ink },
  page: { width: 110, marginRight: 10 },
  pageImg: { width: 110, height: 150, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: C.line },
  pageEmpty: { alignItems: 'center', justifyContent: 'center' },
  pageCap: { fontSize: 12, fontWeight: '700', color: C.ink, marginTop: 4 },
  pageX: { fontSize: 11, color: C.muted },
  pageHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  link: { color: C.blue, fontWeight: '700', fontSize: 13 },
  item: { flexDirection: 'row', gap: 10, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: C.line, marginBottom: 6 },
  itemOn: { borderColor: C.blue, backgroundColor: C.blueSoft },
  itemTitle: { fontSize: 14, fontWeight: '600', color: C.ink, marginBottom: 6, lineHeight: 20 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, padding: 16,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: C.line },
});
