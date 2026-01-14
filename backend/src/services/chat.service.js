// src/services/chat.service.js
const Message = require('../models/Message.model');
const Community = require('../models/Community.model');
const User = require('../models/User.model');
const ApiError = require('../utils/helpers/apiError');
const logger = require('../config/logger');
const redisService = require('./redis.service');
const aiService = require('./ai.service');

class ChatService {
  async sendMessage(data, userId) {
    try {
      const { content, communityId, receiverId, type = 'text', media, replyTo } = data;
      
      // Validate recipient
      if (!communityId && !receiverId) {
        throw new ApiError('Either communityId or receiverId is required', 400);
      }
      
      if (communityId && receiverId) {
        throw new ApiError('Cannot specify both communityId and receiverId', 400);
      }
      
      // AI moderation for content
      let aiAnalysis = null;
      if (content && content.length > 10) {
        try {
          aiAnalysis = await aiService.moderateContent(content);
          
          if (aiAnalysis.flagged || aiAnalysis.toxicity_score > 0.7) {
            throw new ApiError('Message violates community guidelines', 400);
          }
        } catch (aiError) {
          logger.warn(`AI moderation failed: ${aiError.message}`);
        }
      }
      
      // Prepare message data
      const messageData = {
        sender: userId,
        content,
        type,
        aiAnalysis: aiAnalysis ? {
          sentiment: aiAnalysis.sentiment,
          toxicityScore: aiAnalysis.toxicity_score
        } : undefined
      };
      
      // Set recipient
      if (communityId) {
        // Community message
        const community = await Community.findById(communityId);
        
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
          throw new ApiError('You must be a member to send messages in this community', 403);
        }
        
        messageData.community = communityId;
        messageData.channel = `community:${communityId}`;
      } else {
        // Direct message
        const receiver = await User.findById(receiverId);
        
        if (!receiver) {
          throw new ApiError('Receiver not found', 404);
        }
        
        // Check if user is blocking or blocked
        // Add block logic here if needed
        
        messageData.receiver = receiverId;
        messageData.channel = this.getDirectMessageChannel(userId, receiverId);
      }
      
      // Add media if present
      if (media) {
        messageData.media = media;
      }
      
      // Add reply if present
      if (replyTo) {
        const repliedMessage = await Message.findById(replyTo);
        
        if (!repliedMessage) {
          throw new ApiError('Replied message not found', 404);
        }
        
        messageData.replyTo = replyTo;
      }
      
      // Set delivered to sender
      messageData.deliveredTo = [{
        user: userId,
        deliveredAt: new Date()
      }];
      
      // Create message
      const message = await Message.create(messageData);
      
      // Populate sender info
      await message.populate('sender', 'username profile.avatar');
      
      logger.info(`Message sent: ${message._id} by user ${userId}`);
      
      return message;
    } catch (error) {
      logger.error(`Send message failed: ${error.message}`);
      throw error;
    }
  }
  
  async getCommunityMessages(communityId, userId, pagination = {}) {
    try {
      const { page = 1, limit = 50, before = null } = pagination;
      const skip = (page - 1) * limit;
      
      // Check if user is a member
      const community = await Community.findById(communityId);
      
      if (!community) {
        throw new ApiError('Community not found', 404);
      }
      
      const isMember = community.members.some(
        member => member.user.toString() === userId.toString()
      );
      
      if (!isMember) {
        throw new ApiError('You must be a member to view messages', 403);
      }
      
      // Build query
      let query = Message.find({
        community: communityId,
        isDeleted: false,
        $or: [
          { 'deletedFor': { $ne: userId } },
          { 'deletedFor': { $exists: false } }
        ]
      });
      
      // Filter messages before a certain date if provided
      if (before) {
        query = query.where('createdAt').lt(new Date(before));
      }
      
      // Get messages
      const messages = await query
        .sort('-createdAt')
        .skip(skip)
        .limit(limit)
        .populate('sender', 'username profile.avatar')
        .populate({
          path: 'replyTo',
          select: 'content sender',
          populate: {
            path: 'sender',
            select: 'username'
          }
        });
      
      // Mark messages as delivered
      const messageIds = messages.map(msg => msg._id);
      await Message.updateMany(
        { 
          _id: { $in: messageIds },
          'deliveredTo.user': { $ne: userId }
        },
        {
          $push: {
            deliveredTo: {
              user: userId,
              deliveredAt: new Date()
            }
          }
        }
      );
      
      // Reverse to get chronological order
      messages.reverse();
      
      return messages;
    } catch (error) {
      logger.error(`Get community messages failed: ${error.message}`);
      throw error;
    }
  }
  
  async getDirectMessages(userId, otherUserId, pagination = {}) {
    try {
      const { page = 1, limit = 50, before = null } = pagination;
      const skip = (page - 1) * limit;
      
      const channel = this.getDirectMessageChannel(userId, otherUserId);
      
      // Build query
      let query = Message.find({
        channel,
        isDeleted: false,
        $or: [
          { 'deletedFor': { $ne: userId } },
          { 'deletedFor': { $exists: false } }
        ]
      });
      
      // Filter messages before a certain date if provided
      if (before) {
        query = query.where('createdAt').lt(new Date(before));
      }
      
      // Get messages
      const messages = await query
        .sort('-createdAt')
        .skip(skip)
        .limit(limit)
        .populate('sender', 'username profile.avatar')
        .populate('receiver', 'username profile.avatar')
        .populate({
          path: 'replyTo',
          select: 'content sender',
          populate: {
            path: 'sender',
            select: 'username'
          }
        });
      
      // Mark messages as delivered
      const messageIds = messages.map(msg => msg._id);
      await Message.updateMany(
        { 
          _id: { $in: messageIds },
          'deliveredTo.user': { $ne: userId }
        },
        {
          $push: {
            deliveredTo: {
              user: userId,
              deliveredAt: new Date()
            }
          }
        }
      );
      
      // Reverse to get chronological order
      messages.reverse();
      
      return messages;
    } catch (error) {
      logger.error(`Get direct messages failed: ${error.message}`);
      throw error;
    }
  }
  
  async markAsRead(messageId, userId) {
    try {
      const message = await Message.findById(messageId);
      
      if (!message) {
        throw new ApiError('Message not found', 404);
      }
      
      // Check if user is part of the conversation
      const isParticipant = 
        message.sender.toString() === userId.toString() ||
        (message.receiver && message.receiver.toString() === userId.toString()) ||
        (message.community && await this.isCommunityMember(message.community, userId));
      
      if (!isParticipant) {
        throw new ApiError('Not authorized to mark this message as read', 403);
      }
      
      // Mark as read
      const alreadyRead = message.readBy.some(
        read => read.user.toString() === userId.toString()
      );
      
      if (!alreadyRead) {
        message.readBy.push({
          user: userId,
          readAt: new Date()
        });
        
        await message.save();
      }
      
      return message;
    } catch (error) {
      logger.error(`Mark as read failed: ${error.message}`);
      throw error;
    }
  }
  
  async deleteMessage(messageId, userId) {
    try {
      const message = await Message.findById(messageId);
      
      if (!message) {
        throw new ApiError('Message not found', 404);
      }
      
      // Check permission
      const isSender = message.sender.toString() === userId.toString();
      
      if (!isSender) {
        // Check if user is community moderator
        if (message.community) {
          const community = await Community.findById(message.community);
          const isModerator = community.moderators.some(
            mod => mod.user.toString() === userId.toString()
          ) || community.owner.toString() === userId.toString();
          
          if (!isModerator) {
            throw new ApiError('Insufficient permissions', 403);
          }
        } else {
          throw new ApiError('Only sender can delete this message', 403);
        }
      }
      
      // Soft delete
      message.isDeleted = true;
      message.deletedAt = new Date();
      
      // Track who deleted it
      if (!isSender) {
        message.deletedFor = message.deletedFor || [];
        message.deletedFor.push(userId);
      }
      
      await message.save();
      
      logger.info(`Message deleted: ${messageId} by user ${userId}`);
      
      return message;
    } catch (error) {
      logger.error(`Delete message failed: ${error.message}`);
      throw error;
    }
  }
  
  async addReaction(messageId, userId, emoji) {
    try {
      const message = await Message.findById(messageId);
      
      if (!message) {
        throw new ApiError('Message not found', 404);
      }
      
      // Check if user is part of the conversation
      const isParticipant = 
        message.sender.toString() === userId.toString() ||
        (message.receiver && message.receiver.toString() === userId.toString()) ||
        (message.community && await this.isCommunityMember(message.community, userId));
      
      if (!isParticipant) {
        throw new ApiError('Not authorized to react to this message', 403);
      }
      
      // Remove existing reaction from same user
      message.reactions = message.reactions.filter(
        reaction => reaction.user.toString() !== userId.toString()
      );
      
      // Add new reaction
      message.reactions.push({
        user: userId,
        emoji,
        createdAt: new Date()
      });
      
      await message.save();
      
      return message;
    } catch (error) {
      logger.error(`Add reaction failed: ${error.message}`);
      throw error;
    }
  }
  
  async removeReaction(messageId, userId) {
    try {
      const message = await Message.findById(messageId);
      
      if (!message) {
        throw new ApiError('Message not found', 404);
      }
      
      // Remove user's reaction
      message.reactions = message.reactions.filter(
        reaction => reaction.user.toString() !== userId.toString()
      );
      
      await message.save();
      
      return message;
    } catch (error) {
      logger.error(`Remove reaction failed: ${error.message}`);
      throw error;
    }
  }
  
  async getUnreadCount(userId, communityId = null) {
    try {
      let query = {
        $or: [
          { receiver: userId },
          { community: communityId }
        ],
        'readBy.user': { $ne: userId }
      };
      
      if (communityId) {
        query = {
          community: communityId,
          'readBy.user': { $ne: userId }
        };
      }
      
      const count = await Message.countDocuments(query);
      
      return count;
    } catch (error) {
      logger.error(`Get unread count failed: ${error.message}`);
      throw error;
    }
  }
  
  // Helper methods
  getDirectMessageChannel(userId1, userId2) {
    const sortedIds = [userId1.toString(), userId2.toString()].sort();
    return `dm:${sortedIds[0]}:${sortedIds[1]}`;
  }
  
  async isCommunityMember(communityId, userId) {
    const community = await Community.findById(communityId);
    
    if (!community) {
      return false;
    }
    
    return community.members.some(
      member => member.user.toString() === userId.toString()
    );
  }
}

module.exports = new ChatService();