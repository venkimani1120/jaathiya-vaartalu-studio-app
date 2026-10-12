require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../src/models/User');
(async () => {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD, MONGODB_URI } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env');
  await mongoose.connect(MONGODB_URI);
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await User.findOneAndUpdate({ email: ADMIN_EMAIL.toLowerCase() },
    { name: ADMIN_NAME || 'Admin', email: ADMIN_EMAIL.toLowerCase(), passwordHash, role: 'admin', active: true },
    { upsert: true, new: true });
  console.log('Admin ready:', ADMIN_EMAIL);
  await mongoose.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
