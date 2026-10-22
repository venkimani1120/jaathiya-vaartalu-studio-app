const News = require('../models/News');
const User = require('../models/User');

// Cards saved before `source` existed get it from their author's current role. Runs at start-up;
// once every card has a source it is a single empty query.
module.exports = async function backfillNewsSource() {
  const authors = await News.distinct('author', { source: { $exists: false } });
  if (!authors.length) return;
  const users = await User.find({ _id: { $in: authors } }, 'role');
  const role = new Map(users.map(u => [String(u._id), u.role]));
  for (const source of ['reporter', 'editor', 'admin']) {
    const ids = authors.filter(a => (role.get(String(a)) || 'reporter') === source);
    if (ids.length) await News.updateMany({ source: { $exists: false }, author: { $in: ids } }, { $set: { source } });
  }
  console.log(`Set news source for cards by ${authors.length} author(s)`);
};
