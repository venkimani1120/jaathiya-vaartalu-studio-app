import STATES from './locations.json';
// State -> district -> constituencies. AP: 28 districts / 175 seats. Telangana: 33 / 119.
export { STATES };
export const STATE_NAMES = Object.keys(STATES);
export const DISTRICTS = Object.assign({}, ...Object.values(STATES));
export const stateOf = district => STATE_NAMES.find(s => STATES[s][district]);
export const SECTIONS = { constituency: 'నియోజకవర్గం', district: 'జిల్లా', state: 'రాష్ట్రం', sports: 'క్రీడలు', business: 'వాణిజ్యం' };
export const STATUS = {
  draft: { label: 'Draft', color: '#6B7280' },
  submitted: { label: 'Waiting for review', color: '#B45309' },
  approved: { label: 'Approved', color: '#1F3C99' },
  rejected: { label: 'Sent back', color: '#B4231F' },
  published: { label: 'Published', color: '#17734A' },
  imported: { label: 'Not in feed', color: '#6B7280' },   // read from an imported e-paper, not added to the feed yet
};
export const MAX_IMAGES = 10;
