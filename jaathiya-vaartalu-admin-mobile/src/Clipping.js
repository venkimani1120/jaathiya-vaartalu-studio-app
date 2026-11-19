import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { SECTIONS } from './constants';
import { iso } from './DateFilter';
import { Banner, Button, C, Card, Chips, Field, IconButton } from './ui';

// "Download" beside "Edit" on approved news, like the web app: asks for the e-paper header title and date
// (both needed, prefilled), shows the clipping, and shares it as a PDF or PNG (Save to Files / Photos,
// WhatsApp, …). The clipping is drawn as a normal view, so the phone's own Telugu font is used; the PDF
// holds that same picture (as a JPEG) on one page, built here the same way the web app does.

const TE_MONTHS = ['జనవరి', 'ఫిబ్రవరి', 'మార్చి', 'ఏప్రిల్', 'మే', 'జూన్', 'జూలై', 'ఆగస్టు', 'సెప్టెంబర్', 'అక్టోబర్', 'నవంబర్', 'డిసెంబర్'];
const TE_DAYS = ['ఆదివారం', 'సోమవారం', 'మంగళవారం', 'బుధవారం', 'గురువారం', 'శుక్రవారం', 'శనివారం'];
// 'YYYY-MM-DD' -> "బుధవారం, 19 నవంబర్ 2026" (same wording as the web app).
const teluguDate = v => { const [y, m, d] = v.split('-').map(Number); return `${TE_DAYS[new Date(y, m - 1, d).getDay()]}, ${d} ${TE_MONTHS[m - 1]} ${y}`; };
const isDay = v => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(v).getTime());
const DEFAULT_HEADER = 'జాతియ వార్తలు';
const DATES = [[iso(new Date()), 'Today'], [iso(new Date(Date.now() + 864e5)), 'Tomorrow'], [iso(new Date(Date.now() - 864e5)), 'Yesterday']];
const FORMATS = [['pdf', 'PDF', 'document-outline'], ['png', 'PNG image', 'image-outline']];
const OUT_WIDTH = 1080;   // pixels across the saved clipping, as on the web
export const CAN_DOWNLOAD = ['approved', 'published'];

const ascii = str => Uint8Array.from(str, c => c.charCodeAt(0));
const fromBase64 = b64 => Uint8Array.from(atob(b64.replace(/\s/g, '')), c => c.charCodeAt(0));
// Pixel size from a JPEG's frame header, which the PDF must state exactly.
function jpegSize(b) {
  for (let i = 2; i + 8 < b.length;) {
    if (b[i] !== 0xFF) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
    i += 2 + ((b[i + 2] << 8) | b[i + 3]);
  }
  throw new Error('Not a JPEG image.');
}
// A one-page PDF holding the JPEG, page width A4 (595 pt) and as tall as the picture.
function jpegToPdf(jpeg) {
  const { w, h } = jpegSize(jpeg);
  const pw = 595, ph = Math.round(pw * h / w * 100) / 100;
  const content = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
    [`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`, jpeg, '\nendstream'],
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  const parts = [], offsets = [];
  let size = 0;
  const push = p => { const b = typeof p === 'string' ? ascii(p) : p; parts.push(b); size += b.length; };
  push('%PDF-1.4\n');
  objs.forEach((o, i) => { offsets.push(size); push(`${i + 1} 0 obj\n`); [].concat(o).forEach(push); push('\nendobj\n'); });
  const xref = size;
  push(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`);
  push(`trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(size);
  let at = 0;
  for (const b of parts) { out.set(b, at); at += b.length; }
  return out;
}

export function DownloadButton({ news, disabled }) {
  const [open, setOpen] = useState(false);
  if (!news || !CAN_DOWNLOAD.includes(news.status)) return null;
  return <>
    <Button title="Download" icon="download-outline" kind="secondary" onPress={() => setOpen(true)} disabled={disabled} />
    <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
      {open ? <DownloadSheet news={news} onClose={() => setOpen(false)} /> : null}
    </Modal>
  </>;
}

function DownloadSheet({ news, onClose }) {
  const [title, setTitle] = useState(DEFAULT_HEADER);
  const [date, setDate] = useState(DATES[0][0]);
  const [format, setFormat] = useState('pdf');
  const [photo, setPhoto] = useState(news.images?.[0] ? 'loading' : 'none');   // loading | ready | failed | none
  const [size, setSize] = useState(null);   // the clipping view's size on screen
  const [busy, setBusy] = useState(false);
  const shot = useRef(null);
  const { top, bottom } = useSafeAreaInsets();
  const ok = title.trim() && isDay(date);

  const save = async () => {
    if (!ok) return Alert.alert('Missing details', 'Enter the header title and the date (YYYY-MM-DD).');
    setBusy(true);
    let step = 'Making the picture';   // named in the error, to tell which part failed
    try {
      const shape = { width: OUT_WIDTH, height: Math.round(OUT_WIDTH * size.height / size.width) };
      let uri;
      if (format === 'png') uri = await captureRef(shot, { ...shape, format: 'png', quality: 1, result: 'tmpfile' });
      else {
        const jpg = await captureRef(shot, { ...shape, format: 'jpg', quality: 0.92, result: 'base64' });
        step = 'Making the PDF';
        const file = new File(Paths.cache, `jaathiya-vaartalu-${date}-${String(news._id).slice(-6)}.pdf`);
        file.create({ overwrite: true });
        await file.write(jpegToPdf(fromBase64(jpg)));
        uri = file.uri;
      }
      step = 'Opening the share menu';
      if (!uri.startsWith('file://')) uri = `file://${uri}`;
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this phone.');
      await Sharing.shareAsync(uri, format === 'png'
        ? { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Save or share the news' }
        : { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Save or share the news' });
      onClose();
    } catch (e) {
      console.warn('Download failed', step, e);
      Alert.alert('Not downloaded', `${step}: ${e?.message || 'something went wrong.'}`);
    } finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: top }}>
      <View style={s.head}>
        <Text style={s.headTitle}>Download news</Text>
        <IconButton icon="close" label="Close" onPress={onClose} color={C.ink} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 + bottom }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <Card>
          <Field label="E-paper header title" value={title} onChangeText={setTitle} maxLength={60} icon="newspaper-outline"
            error={!title.trim()} hint={!title.trim() ? 'The header title is needed.' : undefined} />
          <Chips label="Date" options={DATES} value={date} onChange={setDate} icon="calendar-outline" />
          <Field value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" maxLength={10} error={!isDay(date)}
            hint={isDay(date) ? teluguDate(date) : 'Type a date like 2026-11-19.'} />
          <Chips label="Format" options={FORMATS} value={format} onChange={setFormat} />
          {photo === 'failed' ? <Banner kind="warn">The photo could not be loaded, so the clipping is made without it.</Banner> : null}
          <Button title={`Download ${format.toUpperCase()}`} icon="download-outline" onPress={save} loading={busy}
            disabled={!ok || !size || photo === 'loading'} />
        </Card>
        <Text style={s.previewLabel}>Preview</Text>
        <View ref={shot} collapsable={false} style={s.paper} onLayout={e => setSize(e.nativeEvent.layout)}>
          <Clipping news={news} title={title.trim() || ' '} date={isDay(date) ? date : DATES[0][0]} photo={photo} onPhoto={setPhoto} />
        </View>
      </ScrollView>
    </View>
  );
}

// The clipping itself: masthead with the header title, a blue date bar, then the story.
function Clipping({ news: n, title, date, photo, onPhoto }) {
  const src = n.images?.[0];
  const [ratio, setRatio] = useState(4 / 3);
  useEffect(() => { if (src) Image.getSize(src, (w, h) => setRatio(Math.max(w / h, 1)), () => onPhoto('failed')); }, [src]);
  const where = [SECTIONS[n.section] || n.section, [n.constituency, n.district].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
  const dateline = (n.dateline || n.constituency || n.district || '').trim();
  return (
    <View>
      <View style={s.mast}>
        <Image source={require('../assets/mark.png')} style={s.mark} resizeMode="contain" />
        <Text style={s.mastText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{title}</Text>
      </View>
      <View style={s.redRule} />
      <View style={s.dateBar}><Text style={s.dateText}>{teluguDate(date)}</Text></View>
      {where ? <Text style={s.where}>{where}</Text> : null}
      <Text style={s.title}>{n.title}</Text>
      {(n.highlights || []).filter(Boolean).length ? (
        <View style={s.hls}>
          {n.highlights.filter(Boolean).map((h, i) => <Text key={i} style={s.hl}><Text style={{ color: C.blue }}>►  </Text>{h}</Text>)}
        </View>
      ) : null}
      {src && photo !== 'failed' ? (
        <Image source={{ uri: src }} style={[s.photo, { aspectRatio: ratio }]} resizeMode="cover"
          onLoad={() => onPhoto('ready')} onError={() => onPhoto('failed')} />
      ) : null}
      <Text style={s.body}>{dateline ? <Text style={{ fontWeight: '700' }}>{dateline}: </Text> : null}{n.body}</Text>
      <View style={[s.redRule, { height: 2, marginTop: 14 }]} />
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: C.line },
  headTitle: { fontSize: 18, fontWeight: '800', color: C.ink },
  previewLabel: { fontSize: 13, fontWeight: '800', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  paper: { backgroundColor: '#fff', padding: 18, borderRadius: 4, borderWidth: 1, borderColor: C.line },
  mast: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  mark: { width: 36, height: 36 },
  mastText: { flexShrink: 1, fontSize: 32, lineHeight: 44, fontWeight: '800', color: C.red },
  redRule: { height: 3, backgroundColor: C.red, marginTop: 4 },
  dateBar: { backgroundColor: C.blue, paddingVertical: 6, marginTop: 4, marginBottom: 12 },
  dateText: { color: '#fff', fontWeight: '700', fontSize: 13, textAlign: 'center' },
  where: { color: C.red, fontWeight: '700', fontSize: 12, marginBottom: 6 },
  title: { fontSize: 21, lineHeight: 31, fontWeight: '800', color: '#141414', marginBottom: 8 },
  hls: { borderLeftWidth: 3, borderLeftColor: C.blue, paddingLeft: 10, marginBottom: 10 },
  hl: { fontSize: 13, lineHeight: 21, fontWeight: '700', color: '#1B2A6B' },
  photo: { width: '100%', marginBottom: 10, backgroundColor: C.bg },
  body: { fontSize: 14, lineHeight: 24, color: '#141414' },
});
