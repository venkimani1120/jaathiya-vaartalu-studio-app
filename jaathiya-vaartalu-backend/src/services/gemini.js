// Reads one newspaper page image with Google's Gemini API (free tier works) and returns its articles.
// Boxes are [ymin, xmin, ymax, xmax] scaled 0-1000 to the image, as Gemini gives them.
const { SECTIONS } = require('../config/constants');

const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
// Tried in order when a model is overloaded (503) or erroring (500/504). All on the free tier.
const FALLBACKS = (process.env.GEMINI_FALLBACK_MODELS ?? 'gemini-3.6-flash,gemini-3.5-flash-lite').split(',').map(s => s.trim()).filter(m => m && m !== MODEL);
const enabled = () => !!KEY;

class RateLimited extends Error {}
class Busy extends Error {}           // every model overloaded: try again later, not a failure of the page
class Unavailable extends Error {}    // model retired or not offered to this key (404): skipped from then on
const gone = new Set();

const box = { type: 'array', items: { type: 'integer' }, description: '[ymin, xmin, ymax, xmax], 0-1000 relative to the image' };
const SCHEMA = {
  type: 'object',
  properties: {
    articles: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          headline: { type: 'string' },
          highlights: { type: 'array', items: { type: 'string' } },
          body: { type: 'string' },
          dateline: { type: 'string' },
          section: { type: 'string', description: Object.keys(SECTIONS).join(' | ') },
          district: { type: 'string' },
          constituency: { type: 'string' },
          box_2d: box,
          photos: { type: 'array', items: { type: 'object', properties: { box_2d: box, caption: { type: 'string' } }, required: ['box_2d'] } }
        },
        required: ['headline', 'body', 'box_2d']
      }
    }
  },
  required: ['articles']
};

function prompt({ publisher, editionName, districts, constituencies }) {
  return `This image is one page of the Telugu newspaper "${publisher}" (${editionName} edition).
List every news article on the page. For each article:
- headline: the main headline exactly as printed, in Telugu script. Do not translate.
- highlights: sub-headlines or highlighted points printed with it (at most 5), else [].
- body: the full article text exactly as printed, in Telugu script, paragraphs separated by a blank line.
  Leave out the dateline, photo captions and "continued on page N" notes.
- dateline: the place name the article starts with (e.g. "గుంటూరు"), else "".
- section: one of ${Object.entries(SECTIONS).map(([k, v]) => `${k} (${v})`).join(', ')}.
- district: the district it is about, written exactly as one of these names, else "": ${districts.join(', ')}.
- constituency: the assembly constituency it is about${constituencies.length ? `, written exactly as one of: ${constituencies.join(', ')}` : ''}, else "".
- box_2d: the box around the whole article (headline, text and its photos).
- photos: each news photo inside the article, with its box_2d and caption.
Skip advertisements, the masthead, page headers and footers, page numbers, weather and index boxes.
Each article appears ONCE. A story with several photos is one article: list all of its photos in its "photos".
A story with a two-line headline, sub-headlines or kickers is one article: put the sub-headlines in "highlights".
If a story is split across columns, return it once with a box covering all of it.`;
}

// image: { buffer, mime }. Returns { articles: [...] } as described by SCHEMA, and the model that answered.
async function extractPage(image, hints) {
  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ inline_data: { mime_type: image.mime, data: image.buffer.toString('base64') } }, { text: prompt(hints) }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0, maxOutputTokens: 65536 }
  });
  let last;
  for (const model of [MODEL, ...FALLBACKS].filter(m => !gone.has(m))) {
    // Free-tier limits are per model, so a rate limit also moves on to the next model.
    try { return { ...(await ask(model, body)), model }; } catch (e) {
      if (e instanceof Unavailable) { gone.add(model); console.error(e.message); continue; }
      if (!(e instanceof Busy || e instanceof RateLimited)) throw e;
      last = e;
    }
  }
  throw last || new Error(`No usable Gemini model (${[MODEL, ...FALLBACKS].join(', ')} are not available to this key). Set GEMINI_MODEL / GEMINI_FALLBACK_MODELS.`);
}

async function ask(model, body) {
  let r;
  try {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY },
      signal: AbortSignal.timeout(240000),
      body
    });
  } catch (e) { throw new Busy(`${model}: ${e.name === 'TimeoutError' ? 'no answer in 4 minutes' : e.message}`); }
  const data = await r.json().catch(() => ({}));
  if (r.status === 429) throw new RateLimited(data.error?.message || 'Rate limit reached.');
  if (r.status === 404) throw new Unavailable(`Gemini model ${model} is not available: ${data.error?.message || 'not found'}`);
  if ([500, 503, 504].includes(r.status)) throw new Busy(`${model}: ${data.error?.message || r.statusText}`);
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${data.error?.message || r.statusText}`);
  const cand = data.candidates?.[0];
  const text = (cand?.content?.parts || []).map(p => p.text || '').join('');
  if (!text) throw new Error(`Gemini returned no text (${cand?.finishReason || data.promptFeedback?.blockReason || 'no answer'}).`);
  if (cand.finishReason === 'MAX_TOKENS') throw new Error('The page has more text than one answer can hold.');
  try { return JSON.parse(text); } catch { throw new Error('Gemini returned an answer that is not valid JSON.'); }
}

module.exports = { enabled, extractPage, RateLimited, Busy, MODEL, FALLBACKS };
