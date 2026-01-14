// src/services/community.service.js
const Community = require('../models/Community.model');
const User = require('../models/User.model');
const ApiError = require('../utils/helpers/apiError');
const logger = require('../config/logger');
const redisService = require('./redis.service');

class CommunityService {
  async createCommunity(data, ownerId) {
    try {
      // Check if community name already exists
      const existingCommunity = await Community.findOne({
        $or: [
          { name: data.name },
          { slug: data.name.toLowerCase().replace(/[^\w\s]/gi, '').replace(/\s+/g, '-') }
        ]
      });
      
      if (existingCommunity) {
        throw new ApiError('Community name already exists', 409);
      }
      
      // Create community
      const community = await Community.create({
        ...data,
        owner: ownerId,
        members: [{
          user: ownerId,
          role: 'admin',
          joinedAt: new Date()
        }],
        stats: {
          memberCount: 1,
          postCount: 0,
          activeMembers: 1
        }
      });
      
      // Add community to user's communities
      await User.findByIdAndUpdate(ownerId, {
        $push: {
          communities: {
            community: community._id,
            role: 'admin',
            joinedAt: new Date()
          }
        }
      });
      
      logger.info(`Community created: ${community.name} by user ${ownerId}`);
      
      // Clear communities cache
      await redisService.clearPattern('communities:*');
      
      return community;
    } catch (error) {
      logger.error(`Community creation failed: ${error.message}`);
      throw error;
    }
  }
  
  async getCommunityById(id, includeMembers = false) {
    try {
      const cacheKey = `community:${id}:${includeMembers}`;
      const cached = await redisService.get(cacheKey);
      
      if (cached) {
        return cached;
      }
      
      let query = Community.findById(id);
      
      if (includeMembers) {
        query = query.populate([
          { path: 'owner', select: 'username email profile.avatar' },
          { path: 'moderators.user', select: 'username email profile.avatar' },
          { path: 'members.user', select: 'username email profile.avatar status.isOnline' }
        ]);
      }
      
      const community = await query;
      
      if (!community) {
        throw new ApiError('Community not found', 404);
      }
      
      await redisService.set(cacheKey, community, 300); // Cache for 5 minutes
      
      return community;
    } catch (error) {
      logger.error(`Get community failed: ${error.message}`);
      throw error;
    }
  }
  
  async getCommunityBySlug(slug) {
    try {
      const cacheKey = `community:slug:${slug}`;
      const cached = await redisService.get(cacheKey);
      
      if (cached) {
        return cached;
      }
      
      const community = await Community.findOne({ slug })
        .populate('owner', 'username email profile.avatar');
      
      if (!community) {
        throw new ApiError('Community not found', 404);
      }
      
      await redisService.set(cacheKey, community, 300);
      
      return community;
    } catch (error) {
      logger.error(`Get community by slug failed: ${error.message}`);
      throw error;
    }
  }
  
  async updateCommunity(id, data, userId) {
    try {
      const community = await Community.findById(id);
      
      if (!community) {
        throw new ApiError('Community not found', 404);
      }
      
      // Check permission
      if (community.owner.toString() !== userId.toString()) {
        const isModerator = community.moderators.some(
          mod => mod.user.toString() === userId.toString()
        );
        
        if (!isModerator) {
          throw new ApiError('Insufficient permissions', 403);
        }
      }
      
      // Update community
      Object.keys(data).forEach(key => {
        community[key] = data[key];
      });
      
      await community.save();
      
      // Clear cache
      await redisService.clearPattern(`community:${id}:*`);
      await redisService.clearPattern('communities:*');
      
      logger.info(`Community updated: ${community.name} by user ${userId}`);
      
      return community;
    } catch (error) {
      logger.error(`Community update failed: ${error.message}`);
      throw error;
    }
  }
  
  async deleteCommunity(id, userId) {
    try {
      const community = await Community.findById(id);
      
      if (!community) {
        throw new ApiError('Community not found', 404);
      }
      
      // Only owner can delete
      if (community.owner.toString() !== userId.toString()) {
        throw new ApiError('Only community owner can delete', 403);
      }
      
      // Soft delete
      community.isActive = false;
      community.deletedAt = new Date();
      await community.save();
      
      // Remove community from all users
      await User.updateMany(
        { 'communities.community': id },
        { $pull: { communities: { community: id } } }
      );
      
      // Clear cache
      await redisService.clearPattern(`community:${id}:*`);
      await redisService.clearPattern('communities:*');
      
      logger.info(`Community deleted: ${community.name} by user ${userId}`);
      
      return community;
    } catch (error) {
      logger.error(`Community deletion failed: ${error.message}`);
      throw error;
    }
  }
  
  async joinCommunity(communityId, userId) {
    try {
      const community = await Community.findById(communityId);
      
      if (!community) {
        throw new ApiError('Community not found', 404);
      }
      
      if (!community.isActive) {
        throw new ApiError('Community is not active', 400);
      }
      
      // Check if already a member
      const isMember = community.members.some(
        member => member.user.toString() === userId.toString()
      );
      
      if (isMember) {
        throw new ApiError('Already a member of this community', 409);
      }
      
      // Check community privacy and join method
      if (community.settings.privacy === 'private' || community.settings.joinMethod === 'invite') {
        throw new ApiError('This community requires an invitation', 403);
      }
      
      // Add user to community members
      community.members.push({
        user: userId,
        role: 'member',
        joinedAt: new Date()
      });
      
      community.stats.memberCount += 1;
      community.stats.activeMembers += 1;
      
      await community.save();
      
      // Add community to user's communities
      await User.findByIdAndUpdate(userId, {
        $push: {
          communities: {
            community: communityId,
            role: 'member',
            joinedAt: new Date()
          }
        }
      });
      
      // Clear cache
      await redisService.clearPattern(`community:${communityId}:*`);
      await redisService.clearPattern(`user:${userId}:communities`);
      
      logger.info(`User ${userId} joined community ${community.name}`);
      
      return community;
    } catch (error) {
      logger.error(`Join community failed: ${error.message}`);
      throw error;
    }
  }
  
  async leaveCommunity(communityId, userId) {
    try {
      const community = await Community.findById(communityId);
      
      if (!community) {
        throw new ApiError('Community not found', 404);
      }
      
      // Check if user is a member
      const memberIndex = community.members.findIndex(
        member => member.user.toString() === userId.toString()
      );
      
      if (memberIndex === -1) {
        throw new ApiError('Not a member of this community', 400);
      }
      
      // Check if user is owner
      if (community.owner.toString() === userId.toString()) {
        throw new ApiError('Community owner cannot leave. Transfer ownership first.', 400);
      }
      
      // Remove user from community members
      community.members.splice(memberIndex, 1);
      community.stats.memberCount -= 1;
      community.stats.activeMembers -= 1;
      
      // Remove from moderators if applicable
      const moderatorIndex = community.moderators.findIndex(
        mod => mod.user.toString() === userId.toString()
      );
      
      if (moderatorIndex !== -1) {
        community.moderators.splice(moderatorIndex, 1);
      }
      
      await community.save();
      
      // Remove community from user's communities
      await User.findByIdAndUpdate(userId, {
        $pull: { communities: { community: communityId } }
      });
      
      // Clear cache
      await redisService.clearPattern(`community:${communityId}:*`);
      await redisService.clearPattern(`user:${userId}:communities`);
      
      logger.info(`User ${userId} left community ${community.name}`);
      
      return community;
    } catch (error) {
      logger.error(`Leave community failed: ${error.message}`);
      throw error;
    }
  }
  
  async getCommunities(filters = {}, pagination = {}) {
    try {
      const { page = 1, limit = 20, sort = '-createdAt', search = '' } = pagination;
      const skip = (page - 1) * limit;
      
      const cacheKey = `communities:${JSON.stringify(filters)}:${page}:${limit}:${sort}:${search}`;
      const cached = await redisService.get(cacheKey);
      
      if (cached) {
        return cached;
      }
      
      // Build query
      let query = Community.find({ isActive: true });
      
      // Apply filters
      if (filters.privacy) {
        query = query.where('settings.privacy').equals(filters.privacy);
      }
      
      if (filters.owner) {
        query = query.where('owner').equals(filters.owner);
      }
      
      if (search) {
        query = query.find({
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
            { tags: { $regex: search, $options: 'i' } }
          ]
        });
      }
      
      // Count total
      const total = await Community.countDocuments(query);
      
      // Apply pagination and sorting
      const communities = await query
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('owner', 'username profile.avatar')
        .select('name slug description avatar stats tags settings.privacy createdAt');
      
      const result = {
        communities,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      };
      
      await redisService.set(cacheKey, result, 60); // Cache for 1 minute
      
      return result;
    } catch (error) {
      logger.error(`Get communities failed: ${error.message}`);
      throw error;
    }
  }
  
  async addModerator(communityId, moderatorId, adminId) {
    try {
      const community = await Community.findById(communityId);
      
      if (!community) {
        throw new ApiError('Community not found', 404);
      }
      
      // Check if admin is owner
      if (community.owner.toString() !== adminId.toString()) {
        throw new ApiError('Only community owner can add moderators', 403);
      }
      
      // Check if user is already a moderator
      const isAlreadyModerator = community.moderators.some(
        mod => mod.user.toString() === moderatorId.toString()
      );
      
      if (isAlreadyModerator) {
        throw new ApiError('User is already a moderator', 409);
      }
      
      // Check if user is a member
      const memberIndex = community.members.findIndex(
        member => member.user.toString() === moderatorId.toString()
      );
      
      if (memberIndex === -1) {
        // Add user as member first
        community.members.push({
          user: moderatorId,
          role: 'moderator',
          joinedAt: new Date()
        });
        
        // Update user's communities
        await User.findByIdAndUpdate(moderatorId, {
          $push: {
            communities: {
              community: communityId,
              role: 'moderator',
              joinedAt: new Date()
            }
          }
        });
      } else {
        // Update member role to moderator
        community.members[memberIndex].role = 'moderator';
      }
      
      // Add to moderators list
      community.moderators.push({
        user: moderatorId,
        addedAt: new Date()
      });
      
      await community.save();
      
      // Clear cache
      await redisService.clearPattern(`community:${communityId}:*`);
      
      logger.info(`User ${moderatorId} added as moderator to community ${community.name}`);
      
      return community;
    } catch (error) {
      logger.error(`Add moderator failed: ${error.message}`);
      throw error;
    }
  }
  
  async removeModerator(communityId, moderatorId, adminId) {
    try {
      const community = await Community.findById(communityId);
      
      if (!community) {
        throw new ApiError('Community not found', 404);
      }
      
      // Check if admin is owner
      if (community.owner.toString() !== adminId.toString()) {
        throw new ApiError('Only community owner can remove moderators', 403);
      }
      
      // Remove from moderators
      const moderatorIndex = community.moderators.findIndex(
        mod => mod.user.toString() === moderatorId.toString()
      );
      
      if (moderatorIndex === -1) {
        throw new ApiError('User is not a moderator', 404);
      }
      
      community.moderators.splice(moderatorIndex, 1);
      
      // Update member role to regular member
      const memberIndex = community.members.findIndex(
        member => member.user.toString() === moderatorId.toString()
      );
      
      if (memberIndex !== -1) {
        community.members[memberIndex].role = 'member';
      }
      
      await community.save();
      
      // Clear cache
      await redisService.clearPattern(`community:${communityId}:*`);
      
      logger.info(`User ${moderatorId} removed as moderator from community ${community.name}`);
      
      return community;
    } catch (error) {
      logger.error(`Remove moderator failed: ${error.message}`);
      throw error;
    }
  }
  
  async getUserCommunities(userId) {
    try {
      const cacheKey = `user:${userId}:communities`;
      const cached = await redisService.get(cacheKey);
      
      if (cached) {
        return cached;
      }
      
      const user = await User.findById(userId).populate({
        path: 'communities.community',
        select: 'name slug description avatar stats.memberCount settings.privacy'
      });
      
      if (!user) {
        throw new ApiError('User not found', 404);
      }
      
      const communities = user.communities;
      
      await redisService.set(cacheKey, communities, 300); // Cache for 5 minutes
      
      return communities;
    } catch (error) {
      logger.error(`Get user communities failed: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new CommunityService();