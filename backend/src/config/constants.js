// src/config/constants.js
module.exports = {
  ROLES: {
    USER: 'user',
    MODERATOR: 'moderator',
    ADMIN: 'admin'
  },
  
  COMMUNITY_PRIVACY: {
    PUBLIC: 'public',
    PRIVATE: 'private',
    RESTRICTED: 'restricted'
  },
  
  POST_TYPES: {
    TEXT: 'text',
    LINK: 'link',
    IMAGE: 'image',
    POLL: 'poll'
  },
  
  MESSAGE_TYPES: {
    TEXT: 'text',
    IMAGE: 'image',
    FILE: 'file',
    SYSTEM: 'system'
  },
  
  NOTIFICATION_TYPES: {
    NEW_COMMENT: 'new_comment',
    NEW_POST: 'new_post',
    NEW_MESSAGE: 'new_message',
    POST_UPVOTED: 'post_upvoted',
    COMMENT_UPVOTED: 'comment_upvoted',
    USER_MENTIONED: 'user_mentioned',
    COMMUNITY_INVITE: 'community_invite'
  },
  
  PAGINATION: {
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
    DEFAULT_PAGE: 1
  },
  
  CACHE_TTL: {
    SHORT: 300, // 5 minutes
    MEDIUM: 1800, // 30 minutes
    LONG: 86400 // 24 hours
  },
  
  FILE_LIMITS: {
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    ALLOWED_FILE_TYPES: ['application/pdf', 'text/plain', 'application/msword']
  },
  
  AI: {
    MAX_CONTENT_LENGTH: 5000,
    TIMEOUT: 10000,
    MAX_RETRIES: 3
  }
};