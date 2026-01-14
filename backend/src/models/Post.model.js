// models/Post.model.js
const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 300
  },
  content: {
    type: String,
    required: true,
    maxlength: 10000
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  community: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Community',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['text', 'link', 'image', 'poll'],
    default: 'text'
  },
  media: [{
    url: String,
    type: { type: String, enum: ['image', 'video', 'document'] },
    thumbnail: String
  }],
  linkPreview: {
    url: String,
    title: String,
    description: String,
    image: String,
    domain: String
  },
  poll: {
    question: String,
    options: [{
      text: String,
      votes: { type: Number, default: 0 },
      voters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    }],
    endsAt: Date,
    isMultiChoice: { type: Boolean, default: false }
  },
  tags: [{
    type: String,
    index: true
  }],
  upvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  downvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  score: { type: Number, default: 0, index: true },
  comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
  commentCount: { type: Number, default: 0, index: true },
  views: { type: Number, default: 0 },
  isPinned: { type: Boolean, default: false },
  isLocked: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  deletedAt: Date,
  aiAnalysis: {
    sentiment: { type: String, enum: ['positive', 'neutral', 'negative'] },
    toxicityScore: Number,
    categories: [String],
    analyzedAt: Date
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
postSchema.index({ community: 1, score: -1 });
postSchema.index({ community: 1, createdAt: -1 });
postSchema.index({ community: 1, isPinned: -1, score: -1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ title: 'text', content: 'text', tags: 'text' });

// Virtual for vote count
postSchema.virtual('voteCount').get(function() {
  return this.upvotes.length - this.downvotes.length;
});

// Pre-save middleware to calculate score (Reddit-style)
postSchema.pre('save', function(next) {
  const ageInHours = (Date.now() - this.createdAt) / (1000 * 60 * 60);
  const voteCount = this.upvotes.length - this.downvotes.length;
  const commentWeight = this.commentCount * 0.5;
  
  // Reddit's hot ranking algorithm simplified
  const order = Math.log10(Math.max(Math.abs(voteCount), 1));
  const sign = voteCount > 0 ? 1 : voteCount < 0 ? -1 : 0;
  const seconds = this.createdAt.getTime() / 1000 - 1134028003;
  
  this.score = Math.round((order + sign * ageInHours / 45000 + commentWeight) * 10000) / 10000;
  next();
});

module.exports = mongoose.model('Post', postSchema);