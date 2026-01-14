// src/middleware/validation.middleware.js
const Joi = require('joi');
const mongoose = require('mongoose');
const ApiError = require('../utils/helpers/apiError');
const asyncHandler = require('../utils/helpers/asyncHandler');

// Custom Joi validation for MongoDB ObjectId
Joi.objectId = require('joi-objectid')(Joi);

const validate = (schema, property = 'body') => {
  return asyncHandler(async (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: false
    });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/['"]/g, '')
      }));
      
      throw new ApiError('Validation failed', 400, errors);
    }
    
    // Replace validated values
    req[property] = value;
    next();
  });
};

// Common validation schemas
const schemas = {
  // Auth schemas
  register: Joi.object({
    username: Joi.string().min(3).max(30).required().trim(),
    email: Joi.string().email().required().lowercase().trim(),
    password: Joi.string().min(6).required(),
    profile: Joi.object({
      firstName: Joi.string().max(50).trim(),
      lastName: Joi.string().max(50).trim(),
      bio: Joi.string().max(500).trim(),
      avatar: Joi.string().uri()
    }).optional()
  }),
  
  login: Joi.object({
    email: Joi.string().email().required().trim(),
    password: Joi.string().required()
  }),
  
  forgotPassword: Joi.object({
    email: Joi.string().email().required().trim()
  }),
  
  resetPassword: Joi.object({
    token: Joi.string().required(),
    password: Joi.string().min(6).required()
  }),
  
  updateProfile: Joi.object({
    profile: Joi.object({
      firstName: Joi.string().max(50).trim(),
      lastName: Joi.string().max(50).trim(),
      bio: Joi.string().max(500).trim(),
      avatar: Joi.string().uri(),
      location: Joi.string().max(100).trim(),
      website: Joi.string().uri().trim(),
      socialLinks: Joi.object({
        twitter: Joi.string().trim(),
        github: Joi.string().trim(),
        linkedin: Joi.string().trim()
      })
    }).optional(),
    preferences: Joi.object({
      emailNotifications: Joi.boolean(),
      pushNotifications: Joi.boolean(),
      theme: Joi.string().valid('light', 'dark')
    }).optional()
  }),
  
  // Community schemas
  createCommunity: Joi.object({
    name: Joi.string().min(3).max(50).required().trim(),
    description: Joi.string().max(500).required().trim(),
    settings: Joi.object({
      privacy: Joi.string().valid('public', 'private', 'restricted'),
      joinMethod: Joi.string().valid('open', 'approval', 'invite'),
      postPermissions: Joi.string().valid('all', 'moderators', 'approved')
    }).optional(),
    tags: Joi.array().items(Joi.string().max(20)).max(10),
    rules: Joi.array().items(
      Joi.object({
        title: Joi.string().max(100).required(),
        description: Joi.string().max(500).required(),
        order: Joi.number().integer().min(0)
      })
    ).max(20)
  }),
  
  updateCommunity: Joi.object({
    description: Joi.string().max(500).trim(),
    settings: Joi.object({
      privacy: Joi.string().valid('public', 'private', 'restricted'),
      joinMethod: Joi.string().valid('open', 'approval', 'invite'),
      postPermissions: Joi.string().valid('all', 'moderators', 'approved'),
      contentVisibility: Joi.string().valid('visible', 'hidden')
    }),
    tags: Joi.array().items(Joi.string().max(20)).max(10),
    bannerImage: Joi.string().uri(),
    avatar: Joi.string().uri(),
    isActive: Joi.boolean()
  }),
  
  // Post schemas
  createPost: Joi.object({
    title: Joi.string().max(300).required().trim(),
    content: Joi.string().max(10000).required(),
    communityId: Joi.objectId().required(),
    type: Joi.string().valid('text', 'link', 'image', 'poll'),
    media: Joi.array().items(
      Joi.object({
        url: Joi.string().uri().required(),
        type: Joi.string().valid('image', 'video', 'document'),
        thumbnail: Joi.string().uri()
      })
    ).max(10),
    linkPreview: Joi.object({
      url: Joi.string().uri().required(),
      title: Joi.string().max(200),
      description: Joi.string().max(500),
      image: Joi.string().uri(),
      domain: Joi.string()
    }),
    poll: Joi.object({
      question: Joi.string().max(300).required(),
      options: Joi.array().items(
        Joi.object({
          text: Joi.string().max(200).required()
        })
      ).min(2).max(10).required(),
      endsAt: Joi.date().min('now'),
      isMultiChoice: Joi.boolean()
    }),
    tags: Joi.array().items(Joi.string().max(20)).max(10)
  }),
  
  // Comment schemas
  createComment: Joi.object({
    content: Joi.string().max(2000).required(),
    postId: Joi.objectId().required(),
    parentCommentId: Joi.objectId()
  }),
  
  // Message schemas
  sendMessage: Joi.object({
    content: Joi.string().max(2000).required(),
    communityId: Joi.objectId(),
    receiverId: Joi.objectId(),
    type: Joi.string().valid('text', 'image', 'file'),
    media: Joi.object({
      url: Joi.string().uri(),
      type: Joi.string(),
      size: Joi.number().max(10 * 1024 * 1024) // 10MB
    }),
    replyTo: Joi.objectId()
  }),
  
  // Pagination schemas
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string(),
    fields: Joi.string(),
    search: Joi.string()
  })
};

module.exports = {
  validate,
  schemas
};