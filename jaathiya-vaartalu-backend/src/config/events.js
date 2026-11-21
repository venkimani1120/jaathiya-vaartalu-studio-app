// Event themes for the e-paper header, used by the studio and the news download. The theme for a date is
// the first event on it: our own days, by month and day, then festivals whose date moves each year, which
// come by name from Google's Indian holidays calendar (synced daily, see services/calendar.js).
// An event that is not listed here leaves the header plain.

// How each style looks. header: picture set (jaathiyavaartalu-<header>-1x/2x.png, made by
// shared/make_event_headers.py, which has the pictures' own colours); stripe: the greeting strip
// (top edge, middle, bottom edge); text: greeting colour on the middle; ink: dark colour for headings and
// bands; rule: accent for lines; font: greeting font.
const STYLES = {
  tricolour: { header: 'tricolour',
    stripe: ['#FF9933', '#FFFFFF', '#138808'], text: '#0B2F8A', ink: '#0B2F8A', rule: '#138808', font: 'Ramabhadra' },
  green: { header: 'green',
    stripe: ['#81C784', '#2E7D32', '#1B5E20'], text: '#FFFFFF', ink: '#1B5E20', rule: '#5D9C3A', font: 'Ramabhadra' },
  festive: { header: 'festive',
    stripe: ['#F9A825', '#B71C1C', '#F9A825'], text: '#FFFFFF', ink: '#B71C1C', rule: '#C8930F', font: 'Ramabhadra' },
};

// day: 'MM-DD' every year. google: the event's names in Google's calendar ("(tentative)" is ignored).
const EVENTS = [
  { id: 'new-year', name: 'నూతన సంవత్సరం', greeting: 'నూతన సంవత్సర శుభాకాంక్షలు', style: 'festive', day: '01-01' },
  { id: 'republic', name: 'గణతంత్ర దినోత్సవం', greeting: 'గణతంత్ర దినోత్సవ శుభాకాంక్షలు', style: 'tricolour', day: '01-26' },
  { id: 'telangana', name: 'తెలంగాణ అవతరణ దినోత్సవం', greeting: 'తెలంగాణ రాష్ట్ర అవతరణ దినోత్సవ శుభాకాంక్షలు', style: 'festive', day: '06-02' },
  { id: 'environment', name: 'ప్రపంచ పర్యావరణ దినోత్సవం', greeting: 'ప్రపంచ పర్యావరణ దినోత్సవం · పర్యావరణాన్ని కాపాడుకుందాం', style: 'green', day: '06-05' },
  { id: 'yoga', name: 'అంతర్జాతీయ యోగా దినోత్సవం', greeting: 'అంతర్జాతీయ యోగా దినోత్సవం', style: 'green', day: '06-21' },
  { id: 'independence', name: 'స్వాతంత్ర్య దినోత్సవం', greeting: 'స్వాతంత్ర్య దినోత్సవ శుభాకాంక్షలు', style: 'tricolour', day: '08-15' },
  { id: 'telugu', name: 'తెలుగు భాషా దినోత్సవం', greeting: 'తెలుగు భాషా దినోత్సవ శుభాకాంక్షలు', style: 'festive', day: '08-29' },
  { id: 'teachers', name: 'ఉపాధ్యాయ దినోత్సవం', greeting: 'ఉపాధ్యాయ దినోత్సవ శుభాకాంక్షలు', style: 'festive', day: '09-05' },
  { id: 'gandhi', name: 'గాంధీ జయంతి', greeting: 'జాతిపిత మహాత్మా గాంధీ జయంతి', style: 'tricolour', day: '10-02' },
  { id: 'andhra', name: 'ఆంధ్రప్రదేశ్ అవతరణ దినోత్సవం', greeting: 'ఆంధ్రప్రదేశ్ అవతరణ దినోత్సవ శుభాకాంక్షలు', style: 'festive', day: '11-01' },
  { id: 'children', name: 'బాలల దినోత్సవం', greeting: 'బాలల దినోత్సవ శుభాకాంక్షలు', style: 'festive', day: '11-14' },
  { id: 'christmas', name: 'క్రిస్మస్', greeting: 'క్రిస్మస్ శుభాకాంక్షలు', style: 'festive', day: '12-25' },
  { id: 'sankranti', name: 'సంక్రాంతి', greeting: 'సంక్రాంతి శుభాకాంక్షలు', style: 'festive', google: ['Makar Sankranti', 'Pongal'] },
  { id: 'ugadi', name: 'ఉగాది', greeting: 'ఉగాది శుభాకాంక్షలు', style: 'festive', google: ['Ugadi'] },
  { id: 'rama-navami', name: 'శ్రీరామనవమి', greeting: 'శ్రీరామనవమి శుభాకాంక్షలు', style: 'festive', google: ['Rama Navami'] },
  { id: 'vinayaka', name: 'వినాయక చవితి', greeting: 'వినాయక చవితి శుభాకాంక్షలు', style: 'festive', google: ['Vinayaka Chathurthi', 'Ganesh Chaturthi'] },
  { id: 'dasara', name: 'విజయదశమి', greeting: 'విజయదశమి శుభాకాంక్షలు', style: 'festive', google: ['Dussehra'] },
  { id: 'deepavali', name: 'దీపావళి', greeting: 'దీపావళి శుభాకాంక్షలు', style: 'festive', google: ['Diwali/Deepavali'] },
  { id: 'ramzan', name: 'రంజాన్', greeting: 'రంజాన్ శుభాకాంక్షలు', style: 'festive', google: ['Ramzan Id'] },
  { id: 'bakrid', name: 'బక్రీద్', greeting: 'బక్రీద్ శుభాకాంక్షలు', style: 'festive', google: ['Bakrid'] },
];

// An event with its style's look, as the apps get it.
const theme = ev => ({ id: ev.id, name: ev.name, greeting: ev.greeting, style: ev.style, ...STYLES[ev.style] });
const THEMES = EVENTS.map(theme);
const baseName = n => String(n).replace(/\s*\(tentative\)\s*$/i, '').trim();

// Themes for 'YYYY-MM-DD', given the names of Google's calendar events on that day. Most fitting first.
function themesOn(date, googleNames = []) {
  const names = new Set(googleNames.map(baseName));
  return EVENTS.filter(ev => ev.day === date.slice(5) || (ev.google || []).some(n => names.has(n))).map(theme);
}

module.exports = { STYLES, EVENTS, THEMES, themesOn };
