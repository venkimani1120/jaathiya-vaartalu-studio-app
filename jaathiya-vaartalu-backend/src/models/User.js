const { Schema, model } = require('mongoose');
const { ROLES } = require('../config/constants');

const userSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ROLES, default: 'reporter' },
  active: { type: Boolean, default: false },   // admin approves every new sign-up
  approvedAt: Date,                             // first approval; unset = sign-up still waiting
  state: String,
  district: String,
  constituency: String,
  avatar: { type: String, maxlength: 500 },  // profile photo URL
  sessionId: { type: String, select: false },   // the one live sign-in; a new sign-in replaces it, sign-out clears it
  sessionSeenAt: { type: Date, select: false }  // last request in that session, for the idle timeout
}, { timestamps: true });

userSchema.methods.toPublic = function () {
  const { _id, name, email, phone, role, active, state, district, constituency, avatar, approvedAt, createdAt } = this;
  return { id: _id, name, email, phone, role, active, state, district, constituency, avatar: avatar || null, approvedAt: approvedAt || null, createdAt };
};
module.exports = model('User', userSchema);
