// src/middleware/auth.middleware.js
const jwt = require('jsonwebtoken');
const ApiError = require('../utils/helpers/apiError');
const asyncHandler = require('../utils/helpers/asyncHandler');
const Token = require('../models/Token.model');
const User = require('../models/User.model');

const auth = asyncHandler(async (req, res, next) => {
  let token;
  
  // Check for token in Authorization header
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  
  if (!token) {
    throw new ApiError('Authentication required', 401);
  }
  
  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    
    // Check if token is blacklisted
    const blacklistedToken = await Token.findOne({
      token,
      type: 'access',
      blacklisted: true
    });
    
    if (blacklistedToken) {
      throw new ApiError('Token has been revoked', 401);
    }
    
    // Get user
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      throw new ApiError('User not found', 404);
    }
    
    // Check if user is locked
    if (user.isLocked && user.isLocked()) {
      throw new ApiError('Account is temporarily locked', 423);
    }
    
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      throw new ApiError('Invalid token', 401);
    }
    if (error.name === 'TokenExpiredError') {
      throw new ApiError('Token expired', 401);
    }
    throw error;
  }
});

const optionalAuth = asyncHandler(async (req, res, next) => {
  let token;
  
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      
      if (user && !user.isLocked()) {
        req.user = user;
      }
    } catch (error) {
      // Don't throw error for optional auth
    }
  }
  
  next();
});

const role = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new ApiError('Authentication required', 401);
    }
    
    if (!roles.includes(req.user.role)) {
      throw new ApiError('Insufficient permissions', 403);
    }
    
    next();
  };
};

const communityAdmin = asyncHandler(async (req, res, next) => {
  const { communityId } = req.params;
  const userId = req.user._id;
  
  const Community = require('../models/Community.model');
  const community = await Community.findById(communityId);
  
  if (!community) {
    throw new ApiError('Community not found', 404);
  }
  
  // Check if user is owner
  if (community.owner.toString() !== userId.toString()) {
    // Check if user is moderator
    const isModerator = community.moderators.some(
      mod => mod.user.toString() === userId.toString()
    );
    
    if (!isModerator) {
      throw new ApiError('Insufficient permissions for this community', 403);
    }
  }
  
  req.community = community;
  next();
});

module.exports = {
  auth,
  optionalAuth,
  role,
  communityAdmin
};