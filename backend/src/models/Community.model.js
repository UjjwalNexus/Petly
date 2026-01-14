// models/Community.model.js
const mongoose = require('mongoose');

const communitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 50,
    index: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    index: true
  },
  description: {
    type: String,
    required: true,
    maxlength: 500
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  moderators: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    addedAt: { type: Date, default: Date.now }
  }],
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    joinedAt: { type: Date, default: Date.now },
    role: { type: String, enum: ['member', 'moderator'], default: 'member' }
  }],
  settings: {
    privacy: {
      type: String,
      enum: ['public', 'private', 'restricted'],
      default: 'public'
    },
    joinMethod: {
      type: String,
      enum: ['open', 'approval', 'invite'],
      default: 'open'
    },
    postPermissions: {
      type: String,
      enum: ['all', 'moderators', 'approved'],
      default: 'all'
    },
    contentVisibility: {
      type: String,
      enum: ['visible', 'hidden'],
      default: 'visible'
    }
  },
  stats: {
    memberCount: { type: Number, default: 0 },
    postCount: { type: Number, default: 0 },
    activeMembers: { type: Number, default: 0 }
  },
  tags: [{
    type: String,
    index: true
  }],
  bannerImage: String,
  avatar: String,
  rules: [{
    title: String,
    description: String,
    order: Number
  }],
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

// Indexes
communitySchema.index({ 'members.user': 1 });
communitySchema.index({ 'stats.memberCount': -1 });
communitySchema.index({ createdAt: -1 });
communitySchema.index({ name: 'text', description: 'text', tags: 'text' });

// Pre-save middleware to generate slug
communitySchema.pre('save', function(next) {
  if (!this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^\w\s]/gi, '')
      .replace(/\s+/g, '-');
  }
  next();
});

module.exports = mongoose.model('Community', communitySchema);