// State -> district -> assembly constituencies (AP 28 districts / 175 seats, Telangana 33 / 119).
// Edit shared/locations.json and copy it here, to mobile/src and into the studio (see README).
const STATES = require('./locations.json');
const DISTRICTS = Object.assign({}, ...Object.values(STATES));
const STATE_OF = Object.fromEntries(Object.entries(STATES).flatMap(([st, ds]) => Object.keys(ds).map(d => [d, st])));
const SECTIONS = { state: 'రాష్ట్రం', district: 'జిల్లా', constituency: 'నియోజకవర్గం', sports: 'క్రీడలు', business: 'వాణిజ్యం' };
const ROLES = ['admin', 'editor', 'reporter'];
const NEWS_STATUS = ['draft', 'submitted', 'approved', 'rejected', 'published'];
// Where a news card came from. Set by the server from the uploader's role (or 'epaper' for imports).
const NEWS_SOURCES = ['reporter', 'editor', 'admin', 'epaper'];
const EDITION_TYPES = ['state', 'district', 'constituency', 'sports', 'business'];
const DAILY_NEWS_LIMIT = Number(process.env.DAILY_NEWS_LIMIT || 50);
const MAX_IMAGES_PER_CARD = 10;
module.exports = { STATES, DISTRICTS, STATE_OF, SECTIONS, ROLES, NEWS_STATUS, NEWS_SOURCES, EDITION_TYPES, DAILY_NEWS_LIMIT, MAX_IMAGES_PER_CARD };
