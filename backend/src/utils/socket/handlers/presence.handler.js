// src/utils/socket/handlers/presence.handler.js
const User = require('../../../models/User.model');
const logger = require('../../../config/logger');

class PresenceHandler {
  constructor() {
    this.userSockets = new Map(); // userId -> Set of socketIds
  }
  
  handleConnect(socket, userId) {
    // Add socket to user's socket set
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId).add(socket.id);
    
    // Update user status if this is the first socket
    if (this.userSockets.get(userId).size === 1) {
      this.updateUserStatus(userId, true);
      
      // Notify user's communities
      this.notifyCommunities(userId, true);
    }
  }
  
  handleDisconnect(socket, userId) {
    // Remove socket from user's socket set
    if (this.userSockets.has(userId)) {
      this.userSockets.get(userId).delete(socket.id);
      
      // Update user status if no sockets left
      if (this.userSockets.get(userId).size === 0) {
        this.updateUserStatus(userId, false);
        
        // Notify user's communities
        this.notifyCommunities(userId, false);
        
        this.userSockets.delete(userId);
      }
    }
  }
  
  async handleUpdatePresence(socket, data) {
    try {
      const { status, customStatus } = data;
      const userId = socket.user._id;
      
      // Update user status in database
      await User.findByIdAndUpdate(userId, {
        'status.lastSeen': new Date(),
        'status.customStatus': customStatus
      });
      
      // Notify user's communities
      socket.to(`presence:${userId}`).emit('presence_update', {
        userId,
        status,
        customStatus,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error(`Update presence error: ${error.message}`);
    }
  }
  
  handleHeartbeat(socket) {
    const userId = socket.user._id;
    
    // Update last seen
    User.findByIdAndUpdate(userId, {
      'status.lastSeen': new Date()
    }).catch(error => {
      logger.error(`Heartbeat update error: ${error.message}`);
    });
  }
  
  async updateUserStatus(userId, isOnline) {
    try {
      await User.findByIdAndUpdate(userId, {
        'status.isOnline': isOnline,
        'status.lastSeen': new Date()
      });
      
      logger.info(`User ${userId} status updated to ${isOnline ? 'online' : 'offline'}`);
    } catch (error) {
      logger.error(`Update user status error: ${error.message}`);
    }
  }
  
  async notifyCommunities(userId, isOnline) {
    try {
      const user = await User.findById(userId).populate('communities.community');
      
      if (!user) return;
      
      // Notify each community
      user.communities.forEach(community => {
        // Emit to community presence room
        const io = require('../../../config/socket').getIO();
        io.to(`community:${community.community._id}:presence`).emit('user_presence', {
          userId,
          username: user.username,
          isOnline,
          lastSeen: new Date()
        });
      });
    } catch (error) {
      logger.error(`Notify communities error: ${error.message}`);
    }
  }
  
  isUserOnline(userId) {
    return this.userSockets.has(userId) && this.userSockets.get(userId).size > 0;
  }
  
  getUserSockets(userId) {
    return this.userSockets.get(userId) || new Set();
  }
}

module.exports = new PresenceHandler();