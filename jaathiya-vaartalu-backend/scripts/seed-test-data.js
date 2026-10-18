// Loads test data for local development: test users, sample photos and news cards in every status.
// Safe to re-run: it removes the previous test users (emails ending @test.local) and their news first.
// Also writes server/test-data/ with sample images and stories you can upload by hand from the app or API.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const News = require('../src/models/News');
const DailyQuota = require('../src/models/DailyQuota');
const { STATES, STATE_OF } = require('../src/config/constants');

const TEST_PASSWORD = 'Test@1234';
const BASE = process.env.PUBLIC_BASE_URL || 'http://localhost:4000';
const SEED_DIR = path.join(__dirname, '../uploads/seed');
const TEST_DIR = path.join(__dirname, '../test-data');

/* ---------- tiny PNG writer (no extra dependencies) ---------- */
const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
// A "photo-like" scene: sky gradient, sun, hills and a few buildings, tinted by hue.
function makePng(w, h, seed) {
  const hue = (seed * 47) % 360;
  const rgb = (hh, s, l) => { const a = s * Math.min(l, 1 - l); const f = n => { const k = (n + hh / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); }; return [f(0), f(8), f(4)]; };
  const sunX = w * (0.2 + (seed % 5) * 0.15), sunY = h * 0.28, sunR = h * 0.09;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const hill = h * (0.62 + 0.08 * Math.sin(x / w * 6 + seed));
      const bldg = (Math.floor(x / (w / 14)) + seed) % 3 === 0 && y > h * (0.5 + 0.1 * ((Math.floor(x / (w / 14)) * 7 + seed) % 3) / 2);
      let c;
      if (bldg && y < hill + h * 0.05) c = rgb((hue + 200) % 360, 0.15, 0.3 + ((x % 24 < 8 && y % 30 < 12) ? 0.35 : 0));
      else if (y > hill) c = rgb((hue + 100) % 360, 0.45, 0.22 + 0.1 * (y - hill) / h);
      else if ((x - sunX) ** 2 + (y - sunY) ** 2 < sunR ** 2) c = [255, 226, 140];
      else c = rgb(hue, 0.55, 0.75 - 0.35 * y / h);
      raw.set(c, y * (w * 3 + 1) + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/* ---------- sample content ---------- */
const STORIES = [
  { section: 'constituency', title: 'గ్రామంలో కొత్త సీసీ రోడ్డు ప్రారంభం', highlights: ['రూ.45 లక్షలతో నిర్మాణం', 'ఎమ్మెల్యే చేతుల మీదుగా ప్రారంభోత్సవం'],
    body: 'గ్రామ ప్రజల చిరకాల కోరిక నెరవేరింది. రూ.45 లక్షల వ్యయంతో నిర్మించిన సీసీ రోడ్డును స్థానిక ఎమ్మెల్యే శనివారం ప్రారంభించారు. వర్షాకాలంలో బురదతో ఇబ్బందులు పడిన ప్రజలకు ఇప్పుడు ఊరట లభించిందని సర్పంచ్ తెలిపారు. కార్యక్రమంలో మండల అధికారులు, గ్రామస్తులు పాల్గొన్నారు.' },
  { section: 'constituency', title: 'ప్రభుత్వ పాఠశాలలో ఉచిత వైద్య శిబిరం', highlights: ['300 మంది విద్యార్థులకు పరీక్షలు', 'కంటి అద్దాల పంపిణీ'],
    body: 'స్థానిక జిల్లా పరిషత్ ఉన్నత పాఠశాలలో ఉచిత వైద్య శిబిరం నిర్వహించారు. సుమారు 300 మంది విద్యార్థులకు వైద్యులు పరీక్షలు చేశారు. దృష్టి లోపం ఉన్న 42 మందికి ఉచితంగా కళ్లద్దాలు అందజేశారు. ఇలాంటి శిబిరాలు తరచూ నిర్వహించాలని తల్లిదండ్రులు కోరారు.' },
  { section: 'constituency', title: 'తాగునీటి సమస్యపై గ్రామస్తుల ధర్నా', highlights: ['పది రోజులుగా నీటి సరఫరా బంద్'],
    body: 'పది రోజులుగా తాగునీరు అందడం లేదని ఆరోపిస్తూ గ్రామస్తులు మండల కార్యాలయం ఎదుట ధర్నా చేశారు. మోటారు మరమ్మతులు చేయించాలని అధికారులకు వినతిపత్రం అందజేశారు. రెండు రోజుల్లో సమస్య పరిష్కరిస్తామని ఎంపీడీవో హామీ ఇచ్చారు.' },
  { section: 'district', title: 'జిల్లాలో రైతులకు ఎరువుల కొరత లేదు: కలెక్టర్', highlights: ['అన్ని కేంద్రాల్లో నిల్వలు సిద్ధం', 'అధిక ధరలకు విక్రయిస్తే చర్యలు'],
    body: 'ఖరీఫ్ సీజన్‌కు అవసరమైన ఎరువులు జిల్లాలోని అన్ని రైతు భరోసా కేంద్రాల్లో అందుబాటులో ఉన్నాయని జిల్లా కలెక్టర్ తెలిపారు. ఎమ్మార్పీ కంటే ఎక్కువ ధరకు విక్రయించే డీలర్లపై కఠిన చర్యలు తీసుకుంటామని హెచ్చరించారు. ఫిర్యాదుల కోసం టోల్‌ఫ్రీ నంబర్ ఏర్పాటు చేశామన్నారు.' },
  { section: 'district', title: 'జిల్లా ఆసుపత్రిలో కొత్త డయాలసిస్ కేంద్రం', highlights: ['పది పడకలతో ఏర్పాటు'],
    body: 'జిల్లా కేంద్ర ఆసుపత్రిలో పది పడకల డయాలసిస్ కేంద్రాన్ని ప్రారంభించారు. ఇప్పటి వరకు రోగులు చికిత్స కోసం దూర ప్రాంతాలకు వెళ్లాల్సి వచ్చేదని, ఇకపై ఇక్కడే ఉచితంగా సేవలు అందుతాయని ఆసుపత్రి సూపరింటెండెంట్ వివరించారు.' },
  { section: 'state', title: 'రాష్ట్రవ్యాప్తంగా భారీ వర్షాలు: వాతావరణ శాఖ హెచ్చరిక', highlights: ['మూడు రోజులు అప్రమత్తంగా ఉండాలి', 'లోతట్టు ప్రాంతాల ప్రజలను తరలించాలని ఆదేశం'],
    body: 'బంగాళాఖాతంలో ఏర్పడిన అల్పపీడనం కారణంగా రానున్న మూడు రోజుల పాటు రాష్ట్రవ్యాప్తంగా భారీ నుంచి అతి భారీ వర్షాలు కురిసే అవకాశం ఉందని వాతావరణ శాఖ తెలిపింది. మత్స్యకారులు వేటకు వెళ్లవద్దని సూచించింది. జిల్లా యంత్రాంగాలు అప్రమత్తంగా ఉండాలని ప్రభుత్వం ఆదేశించింది.' },
  { section: 'state', title: 'కొత్తగా 5 వేల ఉపాధ్యాయ పోస్టుల భర్తీకి నోటిఫికేషన్', highlights: ['వచ్చే నెల నుంచి దరఖాస్తులు'],
    body: 'ప్రభుత్వ పాఠశాలల్లో ఖాళీగా ఉన్న 5 వేల ఉపాధ్యాయ పోస్టుల భర్తీకి ప్రభుత్వం నోటిఫికేషన్ విడుదల చేసింది. వచ్చే నెల మొదటి వారం నుంచి ఆన్‌లైన్‌లో దరఖాస్తులు స్వీకరిస్తారు. పరీక్ష తేదీలను త్వరలో ప్రకటిస్తామని విద్యాశాఖ అధికారులు తెలిపారు.' },
  { section: 'sports', title: 'జిల్లా స్థాయి కబడ్డీ పోటీల్లో విజేతగా స్థానిక జట్టు', highlights: ['ఫైనల్లో 32–27 తేడాతో విజయం', 'రాష్ట్ర స్థాయికి ఎంపిక'],
    body: 'జిల్లా స్థాయి కబడ్డీ పోటీల్లో స్థానిక యువజన సంఘం జట్టు విజేతగా నిలిచింది. ఫైనల్ మ్యాచ్‌లో 32–27 పాయింట్ల తేడాతో ప్రత్యర్థిని ఓడించింది. ఈ జట్టు వచ్చే నెలలో జరిగే రాష్ట్ర స్థాయి పోటీలకు అర్హత సాధించింది. విజేతలకు అతిథులు బహుమతులు అందజేశారు.' },
  { section: 'sports', title: 'క్రికెట్ టోర్నీలో యువ బౌలర్ హ్యాట్రిక్', highlights: ['ఐదు వికెట్లతో సత్తా'],
    body: 'మండల స్థాయి క్రికెట్ టోర్నమెంట్‌లో 17 ఏళ్ల యువ బౌలర్ హ్యాట్రిక్ సహా ఐదు వికెట్లు పడగొట్టి జట్టును గెలిపించాడు. అతని ప్రతిభను గుర్తించిన కోచ్‌లు జిల్లా జట్టు సెలక్షన్‌కు పంపనున్నట్లు తెలిపారు.' },
  { section: 'business', title: 'పత్తి ధర క్వింటాల్‌కు రూ.7,800', highlights: ['మార్కెట్‌కు పెరిగిన రాక', 'రైతుల్లో హర్షం'],
    body: 'స్థానిక వ్యవసాయ మార్కెట్ యార్డులో పత్తి ధర క్వింటాల్‌కు గరిష్ఠంగా రూ.7,800 పలికింది. గత వారంతో పోలిస్తే రూ.300 పెరిగింది. మంగళవారం సుమారు 4 వేల క్వింటాళ్ల పత్తి మార్కెట్‌కు వచ్చిందని కార్యదర్శి తెలిపారు.' },
  { section: 'business', title: 'బంగారం ధర స్వల్పంగా తగ్గుదల', highlights: [],
    body: 'అంతర్జాతీయ మార్కెట్ ప్రభావంతో బంగారం ధర స్వల్పంగా తగ్గింది. 10 గ్రాముల 24 క్యారెట్ల బంగారం ధర రూ.250 తగ్గగా, వెండి కిలోకు రూ.400 తగ్గింది. పండుగ సీజన్ నేపథ్యంలో కొనుగోళ్లు పెరుగుతాయని వ్యాపారులు అంచనా వేస్తున్నారు.' },
  { section: 'constituency', title: 'పేదలకు ఇళ్ల పట్టాల పంపిణీ', highlights: ['120 కుటుంబాలకు లబ్ధి'],
    body: 'నియోజకవర్గంలో 120 పేద కుటుంబాలకు ఇళ్ల స్థలాల పట్టాలను ఎమ్మెల్యే పంపిణీ చేశారు. అర్హులైన ప్రతి ఒక్కరికీ ఇల్లు అందేలా చూస్తామని తెలిపారు. త్వరలో గృహ నిర్మాణ పనులు ప్రారంభమవుతాయని హౌసింగ్ అధికారులు వెల్లడించారు.' }
];

const pickLoc = (stateIdx, i) => {
  const st = Object.keys(STATES)[stateIdx];
  const ds = Object.keys(STATES[st]); const district = ds[i % ds.length];
  const cs = STATES[st][district]; return { district, constituency: cs[i % cs.length] };
};

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  // Clean previous test data
  const old = await User.find({ email: /@test\.local$/ }).select('_id');
  const oldIds = old.map(u => u._id);
  await News.deleteMany({ author: { $in: oldIds } });
  await DailyQuota.deleteMany({ user: { $in: oldIds } });
  await User.deleteMany({ _id: { $in: oldIds } });

  // Users
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);
  const mkUser = (name, email, role, active, loc) => ({ name, email, role, active, passwordHash, phone: '9' + String(100000000 + Math.floor(Math.random() * 899999999)), ...loc, state: loc && STATE_OF[loc.district] });
  const ap0 = pickLoc(0, 3), ap1 = pickLoc(0, 7), tg0 = pickLoc(1, 2), tg1 = pickLoc(1, 5);
  const users = await User.insertMany([
    mkUser('టెస్ట్ ఎడిటర్', 'editor@test.local', 'editor', true, ap0),
    mkUser('రమేష్ (రిపోర్టర్)', 'reporter1@test.local', 'reporter', true, ap0),
    mkUser('సుజాత (రిపోర్టర్)', 'reporter2@test.local', 'reporter', true, ap1),
    mkUser('కిరణ్ (రిపోర్టర్)', 'reporter3@test.local', 'reporter', true, tg0),
    mkUser('పెండింగ్ రిపోర్టర్', 'pending@test.local', 'reporter', false, tg1)
  ]);
  const [editor, ...reporters] = users;
  const activeReporters = reporters.slice(0, 3);
  const repLoc = [ap0, ap1, tg0];

  // Sample photos, served by the API at /uploads/seed/*.png
  fs.mkdirSync(SEED_DIR, { recursive: true });
  const photos = [];
  for (let i = 1; i <= 12; i++) {
    const name = `photo-${String(i).padStart(2, '0')}.png`;
    fs.writeFileSync(path.join(SEED_DIR, name), makePng(960, 640, i));
    photos.push(`${BASE}/uploads/seed/${name}`);
  }

  // News cards: every story, from each reporter, in a spread of statuses
  const statuses = ['approved', 'approved', 'submitted', 'approved', 'rejected', 'draft', 'submitted', 'approved'];
  const docs = [];
  let n = 0;
  activeReporters.forEach((rep, r) => {
    STORIES.forEach((s, i) => {
      const status = statuses[(i + r) % statuses.length];
      const loc = s.section === 'state' ? {} : repLoc[r];
      const imgCount = (i + r) % 4; // 0–3 photos per card
      docs.push({
        ...s, ...loc, state: loc.district ? STATE_OF[loc.district] : Object.keys(STATES)[r === 2 ? 1 : 0],
        dateline: loc.constituency || loc.district || 'అమరావతి', // place only: the studio adds the date
        images: Array.from({ length: imgCount }, (_, k) => photos[(n + k) % photos.length]),
        status, author: rep._id,
        ...(status === 'approved' || status === 'rejected' ? { reviewedBy: editor._id, reviewedAt: new Date() } : {}),
        ...(status === 'rejected' ? { reviewNote: 'ఫోటో స్పష్టంగా లేదు, మరో ఫోటో జత చేసి మళ్లీ పంపండి.' } : {}),
        createdAt: new Date(Date.now() - n * 37 * 60000)
      });
      n++;
    });
  });
  await News.insertMany(docs);

  // Files for manual upload testing (app "Add photos" / POST /api/uploads)
  fs.mkdirSync(path.join(TEST_DIR, 'images'), { recursive: true });
  for (let i = 1; i <= 6; i++) fs.writeFileSync(path.join(TEST_DIR, 'images', `upload-test-${i}.png`), makePng(1280, 853, 20 + i));
  fs.writeFileSync(path.join(TEST_DIR, 'sample-news.json'), JSON.stringify(STORIES.slice(0, 5).map(s => ({ ...s, ...pickLoc(0, 3) })), null, 2));
  fs.writeFileSync(path.join(TEST_DIR, 'sample-news.txt'), STORIES.map(s => `శీర్షిక: ${s.title}\nముఖ్యాంశాలు: ${s.highlights.join(' | ')}\n\n${s.body}\n`).join('\n----------------------------------------\n\n'));

  const count = s => docs.filter(d => d.status === s).length;
  console.log(`Test data loaded: ${users.length} users, ${docs.length} news cards ` +
    `(approved ${count('approved')}, submitted ${count('submitted')}, rejected ${count('rejected')}, draft ${count('draft')}), ${photos.length} photos.`);
  console.log(`Logins (password ${TEST_PASSWORD}): ${users.map(u => `${u.email}${u.active ? '' : ' [pending approval]'}`).join(', ')}`);
  console.log(`Upload test files: ${TEST_DIR}`);
  await mongoose.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
