// src/utils/socket/handlers/chat.handler.js
const Message = require('../../../models/Message.model');
const Community = require('../../../models/Community.model');
const logger = require('../../../config/logger');

class ChatHandler {
  async handleJoinCommunity(socket, data) {
    try {
      const { communityId } = data;
      const userId = socket.user._id;
      
      // Check if user is a member
      const community = await Community.findById(communityId);
      
      if (!community) {
        socket.emit('error', { message: 'Community not found' });
        return;
      }
      
      const isMember = community.members.some(
        member => member.user.toString() === userId.toString()
      );
      
      if (!isMember) {
        socket.emit('error', { message: 'You must be a member to join chat' });
        return;
      }
      
      // Join community room
      socket.join(`community:${communityId}`);
      
      // Join user's presence room
      socket.join(`community:${communityId}:presence`);
      
      // Notify others in community
      socket.to(`community:${communityId}:presence`).emit('user_joined', {
        userId,
        username: socket.user.username,
        timestamp: new Date()
      });
      
      logger.info(`User ${userId} joined community chat ${communityId}`);
    } catch (error) {
      logger.error(`Join community error: ${error.message}`);
      socket.emit('error', { message: error.message });
    }
  }
  
  async handleLeaveCommunity(socket, data) {
    try {
      const { communityId } = data;
      const userId = socket.user._id;
      
      // Leave community room
      socket.leave(`community:${communityId}`);
      socket.leave(`community:${communityId}:presence`);
      
      // Notify others
      socket.to(`community:${communityId}:presence`).emit('user_left', {
        userId,
        username: socket.user.username,
        timestamp: new Date()
      });
      
      logger.info(`User ${userId} left community chat ${communityId}`);
    } catch (error) {
      logger.error(`Leave community error: ${error.message}`);
      socket.emit('error', { message: error.message });
    }
  }
  
  async handleSendMessage(socket, data) {
    try {
      const { content, communityId, receiverId, type, media, replyTo } = data;
      const userId = socket.user._id;
      
      const chatService = require('../../../services/chat.service');
      const message = await chatService.sendMessage({
        content,
        communityId,
        receiverId,
        type,
        media,
        replyTo
      }, userId);
      
      // Emit message to appropriate recipients
      if (communityId) {
        // Community message
        socket.to(`community:${communityId}`).emit('new_message', {
          message: message.toJSON()
        });
      } else if (receiverId) {
        // Direct message
        const channel = chatService.getDirectMessageChannel(userId, receiverId);
        
        // Emit to sender
        socket.emit('new_message', {
          message: message.toJSON()
        });
        
        // Emit to receiver
        socket.to(`user:${receiverId}`).emit('new_message', {
          message: message.toJSON()
        });
        
        // Also emit to DM channel for both users
        socket.to(channel).emit('new_message', {
          message: message.toJSON()
        });
      }
      
      logger.info(`Message sent via socket: ${message._id}`);
    } catch (error) {
      logger.error(`Send message error: ${error.message}`);
      socket.emit('error', { message: error.message });
    }
  }
  
  async handleTypingStart(socket, data) {
    try {
      const { communityId, receiverId } = data;
      const userId = socket.user._id;
      
      if (communityId) {
        socket.to(`community:${communityId}`).emit('user_typing', {
          userId,
          username: socket.user.username,
          isTyping: true
        });
      } else if (receiverId) {
        socket.to(`user:${receiverId}`).emit('user_typing', {
          userId,
          username: socket.user.username,
          isTyping: true
        });
      }
    } catch (error) {
      logger.error(`Typing start error: ${error.message}`);
    }
  }
  
  async handleTypingStop(socket, data) {
    try {
      const { communityId, receiverId } = data;
      const userId = socket.user._id;
      
      if (communityId) {
        socket.to(`community:${communityId}`).emit('user_typing', {
          userId,
          username: socket.user.username,
          isTyping: false
        });
      } else if (receiverId) {
        socket.to(`user:${receiverId}`).emit('user_typing', {
          userId,
          username: socket.user.username,
          isTyping: false
        });
      }
    } catch (error) {
      logger.error(`Typing stop error: ${error.message}`);
    }
  }
  
  async handleReadReceipt(socket, data) {
    try {
      const { messageId } = data;
      const userId = socket.user._id;
      
      const chatService = require('../../../services/chat.service');
      const message = await chatService.markAsRead(messageId, userId);
      
      // Notify sender that message was read
      if (message.sender.toString() !== userId.toString()) {
        socket.to(`user:${message.sender}`).emit('message_read', {
          messageId: message._id,
          readBy: userId,
          readAt: new Date()
        });
      }
      
      // If community message, notify in community
      if (message.community) {
        socket.to(`community:${message.community}`).emit('message_read', {
          messageId: message._id,
          readBy: userId,
          readAt: new Date()
        });
      }
    } catch (error) {
      logger.error(`Read receipt error: ${error.message}`);
      socket.emit('error', { message: error.message });
    }
  }
}

module.exports = new ChatHandler();