// config/socket.js
const socketIO = require('socket.io');
const socketAuth = require('../utils/socket/middleware');
const chatHandler = require('../utils/socket/handlers/chat.handler');
const presenceHandler = require('../utils/socket/handlers/presence.handler');
const logger = require('./logger');

class SocketServer {
  constructor(server) {
    this.io = socketIO(server, {
      cors: {
        origin: process.env.CLIENT_URL,
        credentials: true
      },
      pingInterval: 25000,
      pingTimeout: 60000,
      transports: ['websocket', 'polling']
    });

    this.initialize();
  }

  initialize() {
    // Authentication middleware
    this.io.use(socketAuth);

    this.io.on('connection', (socket) => {
      const userId = socket.user?._id;
      logger.info(`Socket connected: ${socket.id}, User: ${userId}`);

      // Join user to their personal room
      if (userId) {
        socket.join(`user:${userId}`);
        socket.join(`presence:${userId}`);
        
        // Update user presence
        presenceHandler.handleConnect(socket, userId);
      }

      // Register event handlers
      this.registerHandlers(socket);

      socket.on('disconnect', () => {
        logger.info(`Socket disconnected: ${socket.id}`);
        if (userId) {
          presenceHandler.handleDisconnect(socket, userId);
        }
      });

      socket.on('error', (error) => {
        logger.error(`Socket error: ${error.message}`);
      });
    });
  }

  registerHandlers(socket) {
    // Chat events
    socket.on('join_community', (data) => chatHandler.handleJoinCommunity(socket, data));
    socket.on('leave_community', (data) => chatHandler.handleLeaveCommunity(socket, data));
    socket.on('send_message', (data) => chatHandler.handleSendMessage(socket, data));
    socket.on('typing_start', (data) => chatHandler.handleTypingStart(socket, data));
    socket.on('typing_stop', (data) => chatHandler.handleTypingStop(socket, data));
    socket.on('read_receipt', (data) => chatHandler.handleReadReceipt(socket, data));

    // Post events
    socket.on('upvote_post', (data) => this.handleUpvotePost(socket, data));
    socket.on('downvote_post', (data) => this.handleDownvotePost(socket, data));
    socket.on('new_comment', (data) => this.handleNewComment(socket, data));

    // Presence events
    socket.on('update_presence', (data) => presenceHandler.handleUpdatePresence(socket, data));
    socket.on('heartbeat', () => presenceHandler.handleHeartbeat(socket));
  }

  async handleUpvotePost(socket, data) {
    try {
      const { postId } = data;
      const userId = socket.user._id;

      const postService = require('../services/post.service');
      const updatedPost = await postService.upvotePost(postId, userId);

      // Emit to community room
      socket.to(`community:${updatedPost.community}`).emit('post_updated', {
        type: 'upvote',
        postId,
        userId,
        score: updatedPost.score
      });

      // Emit to post room for real-time updates
      this.io.to(`post:${postId}`).emit('vote_update', {
        postId,
        upvotes: updatedPost.upvotes.length,
        downvotes: updatedPost.downvotes.length,
        score: updatedPost.score,
        userVote: 'up'
      });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  }

  async handleNewComment(socket, data) {
    try {
      const { postId, content, parentCommentId } = data;
      const userId = socket.user._id;

      const commentService = require('../services/comment.service');
      const comment = await commentService.createComment({
        postId,
        content,
        author: userId,
        parentComment: parentCommentId
      });

      // Emit to post room
      this.io.to(`post:${postId}`).emit('new_comment', {
        comment: comment.toJSON(),
        postId
      });

      // Notify post author if different from commenter
      const post = await require('../models/Post.model').findById(postId);
      if (post.author.toString() !== userId.toString()) {
        this.io.to(`user:${post.author}`).emit('notification', {
          type: 'new_comment',
          postId,
          commentId: comment._id,
          commenterId: userId,
          message: `${socket.user.username} commented on your post`
        });
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  }

  // Get IO instance
  getIO() {
    return this.io;
  }
}

module.exports = SocketServer;