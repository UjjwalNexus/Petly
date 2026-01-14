// src/services/post.service.js
const Post = require('../models/Post.model');
const Community = require('../models/Community.model');
const User = require('../models/User.model');
const ApiError = require('../utils/helpers/apiError');
const logger = require('../config/logger');
const redisService = require('./redis.service');
const aiService = require('./ai.service');

class PostService {
  async createPost(data, userId) {
    try {
      // Check if community exists and user is a member
      const community = await Community.findById(data.communityId);
      
      if (!community) {
        throw new ApiError('Community not found', 404);
      }
      
      if (!community.isActive) {
        throw new ApiError('Community is not active', 400);
      }
      
      // Check if user is a member
      const isMember = community.members.some(
        member => member.user.toString() === userId.toString()
      );
      
      if (!isMember) {
        throw new ApiError('You must be a member to post in this community', 403);
      }
      
      // Check post permissions
      if (community.settings.postPermissions === 'moderators') {
        const isModerator = community.moderators.some(
          mod => mod.user.toString() === userId.toString()
        ) || community.owner.toString() === userId.toString();
        
        if (!isModerator) {
          throw new ApiError('Only moderators can post in this community', 403);
        }
      }
      
      // AI moderation for content
      let aiAnalysis = null;
      if (data.content && data.content.length > 10) {
        try {
          aiAnalysis = await aiService.moderateContent(data.content);
          
          // Check if content is safe
          if (aiAnalysis.flagged || aiAnalysis.toxicity_score > 0.7) {
            throw new ApiError('Content violates community guidelines', 400);
          }
        } catch (aiError) {
          logger.warn(`AI moderation failed: ${aiError.message}`);
          // Continue without AI analysis if service is down
        }
      }
      
      // Create post
      const postData = {
        ...data,
        author: userId,
        community: data.communityId,
        aiAnalysis: aiAnalysis ? {
          sentiment: aiAnalysis.sentiment,
          toxicityScore: aiAnalysis.toxicity_score,
          categories: aiAnalysis.categories || [],
          analyzedAt: new Date()
        } : undefined
      };
      
      delete postData.communityId;
      
      const post = await Post.create(postData);
      
      // Update community stats
      community.stats.postCount += 1;
      await community.save();
      
      // Clear cache
      await redisService.clearPattern(`community:${data.communityId}:posts:*`);
      await redisService.clearPattern(`user:${userId}:posts`);
      
      logger.info(`Post created: ${post._id} by user ${userId} in community ${data.communityId}`);
      
      return post;
    } catch (error) {
      logger.error(`Post creation failed: ${error.message}`);
      throw error;
    }
  }
  
  async getPostById(id, userId = null) {
    try {
      const cacheKey = `post:${id}:${userId || 'anonymous'}`;
      const cached = await redisService.get(cacheKey);
      
      if (cached) {
        return cached;
      }
      
      let query = Post.findById(id)
        .populate('author', 'username profile.avatar')
        .populate('community', 'name slug avatar');
      
      if (userId) {
        // Increment view count if user is viewing
        await Post.findByIdAndUpdate(id, { $inc: { views: 1 } });
      }
      
      const post = await query;
      
      if (!post) {
        throw new ApiError('Post not found', 404);
      }
      
      if (post.isDeleted) {
        throw new ApiError('Post has been deleted', 404);
      }
      
      await redisService.set(cacheKey, post, 60); // Cache for 1 minute
      
      return post;
    } catch (error) {
      logger.error(`Get post failed: ${error.message}`);
      throw error;
    }
  }
  
  async updatePost(id, data, userId) {
    try {
      const post = await Post.findById(id);
      
      if (!post) {
        throw new ApiError('Post not found', 404);
      }
      
      // Check permission
      if (post.author.toString() !== userId.toString()) {
        // Check if user is community moderator
        const community = await Community.findById(post.community);
        const isModerator = community.moderators.some(
          mod => mod.user.toString() === userId.toString()
        ) || community.owner.toString() === userId.toString();
        
        if (!isModerator) {
          throw new ApiError('Insufficient permissions', 403);
        }
      }
      
      // AI moderation for updated content
      if (data.content && data.content.length > 10) {
        try {
          const aiAnalysis = await aiService.moderateContent(data.content);
          
          if (aiAnalysis.flagged || aiAnalysis.toxicity_score > 0.7) {
            throw new ApiError('Content violates community guidelines', 400);
          }
          
          data.aiAnalysis = {
            sentiment: aiAnalysis.sentiment,
            toxicityScore: aiAnalysis.toxicity_score,
            categories: aiAnalysis.categories || [],
            analyzedAt: new Date()
          };
        } catch (aiError) {
          logger.warn(`AI moderation failed: ${aiError.message}`);
        }
      }
      
      // Update post
      Object.keys(data).forEach(key => {
        post[key] = data[key];
      });
      
      post.isEdited = true;
      post.editedAt = new Date();
      
      await post.save();
      
      // Clear cache
      await redisService.clearPattern(`post:${id}:*`);
      await redisService.clearPattern(`community:${post.community}:posts:*`);
      
      logger.info(`Post updated: ${post._id} by user ${userId}`);
      
      return post;
    } catch (error) {
      logger.error(`Post update failed: ${error.message}`);
      throw error;
    }
  }
  
  async deletePost(id, userId) {
    try {
      const post = await Post.findById(id);
      
      if (!post) {
        throw new ApiError('Post not found', 404);
      }
      
      // Check permission
      if (post.author.toString() !== userId.toString()) {
        // Check if user is community moderator
        const community = await Community.findById(post.community);
        const isModerator = community.moderators.some(
          mod => mod.user.toString() === userId.toString()
        ) || community.owner.toString() === userId.toString();
        
        if (!isModerator) {
          throw new ApiError('Insufficient permissions', 403);
        }
      }
      
      // Soft delete
      post.isDeleted = true;
      post.deletedAt = new Date();
      await post.save();
      
      // Update community stats
      await Community.findByIdAndUpdate(post.community, {
        $inc: { 'stats.postCount': -1 }
      });
      
      // Clear cache
      await redisService.clearPattern(`post:${id}:*`);
      await redisService.clearPattern(`community:${post.community}:posts:*`);
      
      logger.info(`Post deleted: ${post._id} by user ${userId}`);
      
      return post;
    } catch (error) {
      logger.error(`Post deletion failed: ${error.message}`);
      throw error;
    }
  }
  
  async getPostsByCommunity(communityId, filters = {}, pagination = {}) {
    try {
      const { page = 1, limit = 20, sort = '-score' } = pagination;
      const skip = (page - 1) * limit;
      
      const cacheKey = `community:${communityId}:posts:${JSON.stringify(filters)}:${page}:${limit}:${sort}`;
      const cached = await redisService.get(cacheKey);
      
      if (cached) {
        return cached;
      }
      
      // Build query
      let query = Post.find({
        community: communityId,
        isDeleted: false
      });
      
      // Apply filters
      if (filters.author) {
        query = query.where('author').equals(filters.author);
      }
      
      if (filters.type) {
        query = query.where('type').equals(filters.type);
      }
      
      if (filters.tags && filters.tags.length > 0) {
        query = query.where('tags').in(filters.tags);
      }
      
      // Handle pinned posts
      let pinnedPosts = [];
      if (page === 1 && sort !== '-createdAt') {
        pinnedPosts = await Post.find({
          community: communityId,
          isDeleted: false,
          isPinned: true
        })
        .populate('author', 'username profile.avatar')
        .select('title author upvotes downvotes score commentCount createdAt isPinned')
        .limit(5);
      }
      
      // Count total
      const total = await Post.countDocuments(query);
      
      // Apply pagination and sorting
      let posts = await query
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('author', 'username profile.avatar')
        .select('title author upvotes downvotes score commentCount views createdAt type media tags isPinned');
      
      // Combine pinned and regular posts for first page
      if (page === 1 && sort !== '-createdAt' && pinnedPosts.length > 0) {
        const pinnedIds = pinnedPosts.map(p => p._id.toString());
        posts = posts.filter(p => !pinnedIds.includes(p._id.toString()));
        posts = [...pinnedPosts, ...posts];
      }
      
      const result = {
        posts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      };
      
      await redisService.set(cacheKey, result, 30); // Cache for 30 seconds
      
      return result;
    } catch (error) {
      logger.error(`Get community posts failed: ${error.message}`);
      throw error;
    }
  }
  
  async upvotePost(postId, userId) {
    try {
      const post = await Post.findById(postId);
      
      if (!post) {
        throw new ApiError('Post not found', 404);
      }
      
      if (post.isDeleted) {
        throw new ApiError('Post has been deleted', 404);
      }
      
      // Check if user already upvoted
      const alreadyUpvoted = post.upvotes.includes(userId);
      const alreadyDownvoted = post.downvotes.includes(userId);
      
      if (alreadyUpvoted) {
        // Remove upvote
        post.upvotes.pull(userId);
      } else {
        // Add upvote
        post.upvotes.push(userId);
        
        // Remove downvote if exists
        if (alreadyDownvoted) {
          post.downvotes.pull(userId);
        }
      }
      
      await post.save();
      
      // Clear cache
      await redisService.clearPattern(`post:${postId}:*`);
      await redisService.clearPattern(`community:${post.community}:posts:*`);
      
      logger.info(`Post ${postId} upvoted by user ${userId}`);
      
      return post;
    } catch (error) {
      logger.error(`Upvote post failed: ${error.message}`);
      throw error;
    }
  }
  
  async downvotePost(postId, userId) {
    try {
      const post = await Post.findById(postId);
      
      if (!post) {
        throw new ApiError('Post not found', 404);
      }
      
      if (post.isDeleted) {
        throw new ApiError('Post has been deleted', 404);
      }
      
      // Check if user already downvoted
      const alreadyDownvoted = post.downvotes.includes(userId);
      const alreadyUpvoted = post.upvotes.includes(userId);
      
      if (alreadyDownvoted) {
        // Remove downvote
        post.downvotes.pull(userId);
      } else {
        // Add downvote
        post.downvotes.push(userId);
        
        // Remove upvote if exists
        if (alreadyUpvoted) {
          post.upvotes.pull(userId);
        }
      }
      
      await post.save();
      
      // Clear cache
      await redisService.clearPattern(`post:${postId}:*`);
      await redisService.clearPattern(`community:${post.community}:posts:*`);
      
      logger.info(`Post ${postId} downvoted by user ${userId}`);
      
      return post;
    } catch (error) {
      logger.error(`Downvote post failed: ${error.message}`);
      throw error;
    }
  }
  
  async pinPost(postId, userId) {
    try {
      const post = await Post.findById(postId);
      
      if (!post) {
        throw new ApiError('Post not found', 404);
      }
      
      // Check if user is community moderator
      const community = await Community.findById(post.community);
      const isModerator = community.moderators.some(
        mod => mod.user.toString() === userId.toString()
      ) || community.owner.toString() === userId.toString();
      
      if (!isModerator) {
        throw new ApiError('Only moderators can pin posts', 403);
      }
      
      post.isPinned = true;
      await post.save();
      
      // Clear cache
      await redisService.clearPattern(`post:${postId}:*`);
      await redisService.clearPattern(`community:${post.community}:posts:*`);
      
      logger.info(`Post ${postId} pinned by user ${userId}`);
      
      return post;
    } catch (error) {
      logger.error(`Pin post failed: ${error.message}`);
      throw error;
    }
  }
  
  async unpinPost(postId, userId) {
    try {
      const post = await Post.findById(postId);
      
      if (!post) {
        throw new ApiError('Post not found', 404);
      }
      
      // Check if user is community moderator
      const community = await Community.findById(post.community);
      const isModerator = community.moderators.some(
        mod => mod.user.toString() === userId.toString()
      ) || community.owner.toString() === userId.toString();
      
      if (!isModerator) {
        throw new ApiError('Only moderators can unpin posts', 403);
      }
      
      post.isPinned = false;
      await post.save();
      
      // Clear cache
      await redisService.clearPattern(`post:${postId}:*`);
      await redisService.clearPattern(`community:${post.community}:posts:*`);
      
      logger.info(`Post ${postId} unpinned by user ${userId}`);
      
      return post;
    } catch (error) {
      logger.error(`Unpin post failed: ${error.message}`);
      throw error;
    }
  }
  
  async searchPosts(query, communityId = null, pagination = {}) {
    try {
      const { page = 1, limit = 20 } = pagination;
      const skip = (page - 1) * limit;
      
      const searchQuery = {
        $text: { $search: query },
        isDeleted: false
      };
      
      if (communityId) {
        searchQuery.community = communityId;
      }
      
      const posts = await Post.find(searchQuery)
        .skip(skip)
        .limit(limit)
        .populate('author', 'username profile.avatar')
        .populate('community', 'name slug')
        .select('title content author community score commentCount createdAt')
        .sort({ score: -1 });
      
      const total = await Post.countDocuments(searchQuery);
      
      return {
        posts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error(`Search posts failed: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new PostService();