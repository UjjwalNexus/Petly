// mongo-init.js
db = db.getSiblingDB('community_db');

// Create admin user for application
db.createUser({
  user: 'community_user',
  pwd: 'community_password',
  roles: [
    {
      role: 'readWrite',
      db: 'community_db'
    }
  ]
});

// Create indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ 'status.lastSeen': -1 });
db.users.createIndex({ username: 'text', 'profile.firstName': 'text', 'profile.lastName': 'text' });

db.communities.createIndex({ name: 1 }, { unique: true });
db.communities.createIndex({ slug: 1 }, { unique: true });
db.communities.createIndex({ 'members.user': 1 });
db.communities.createIndex({ name: 'text', description: 'text', tags: 'text' });

db.posts.createIndex({ community: 1, score: -1 });
db.posts.createIndex({ community: 1, createdAt: -1 });
db.posts.createIndex({ author: 1, createdAt: -1 });
db.posts.createIndex({ title: 'text', content: 'text', tags: 'text' });

db.comments.createIndex({ post: 1, createdAt: -1 });
db.comments.createIndex({ author: 1, createdAt: -1 });

db.messages.createIndex({ community: 1, createdAt: -1 });
db.messages.createIndex({ channel: 1, createdAt: -1 });
db.messages.createIndex({ sender: 1, receiver: 1, createdAt: -1 });

db.tokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
db.tokens.createIndex({ token: 1, type: 1 });

print('Database initialization completed.');