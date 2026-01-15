import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/petcare';
        await mongoose.connect(mongoURI);

        console.log('✅ MongoDB Connected Successfully');
        console.log('✅ Connected DB name:', mongoose.connection.name);

    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error.message);
        throw error;
    }
};


// 1. USER SCHEMA
const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: 6
    },
    profilePic: {
        type: String,
        default: 'default-avatar.png'
    },
    petName: {
        type: String,
        default: ''
    },
    petType: {
        type: String,
        enum: ['dog', 'cat', 'bird', 'fish', 'rabbit', 'other'],
        default: 'other'
    },
    petBreed: {
        type: String,
        default: ''
    },
    petAge: {
        type: Number,
        min: 0,
        default: 0
    },
    location: {
        type: String,
        default: ''
    },
    bio: {
        type: String,
        default: 'Pet lover and community member',
        maxlength: 500
    },
    joinDate: {
        type: Date,
        default: Date.now
    },
    lastActive: {
        type: Date,
        default: Date.now
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    followers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    following: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    notifications: [{
        type: {
            type: String,
            enum: ['like', 'comment', 'follow', 'mention', 'system']
        },
        fromUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        postId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Post'
        },
        message: String,
        read: {
            type: Boolean,
            default: false
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    settings: {
        emailNotifications: {
            type: Boolean,
            default: true
        },
        pushNotifications: {
            type: Boolean,
            default: true
        },
        privacy: {
            type: String,
            enum: ['public', 'private', 'friends'],
            default: 'public'
        }
    }
}, { timestamps: true });

// Hash password before saving
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Compare password method
UserSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// 2. POST SCHEMA (Community Posts)
const PostSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: [true, 'Post content is required'],
        maxlength: 2000
    },
    images: [{
        url: String,
        publicId: String,
        caption: String
    }],
    videos: [{
        url: String,
        publicId: String,
        thumbnail: String
    }],
    hashtags: [String],
    mentions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    location: {
        type: String,
        default: ''
    },
    petType: {
        type: String,
        enum: ['dog', 'cat', 'bird', 'fish', 'rabbit', 'other', 'all'],
        default: 'all'
    },
    visibility: {
        type: String,
        enum: ['public', 'private', 'friends'],
        default: 'public'
    },
    likesCount: {
        type: Number,
        default: 0
    },
    commentsCount: {
        type: Number,
        default: 0
    },
    sharesCount: {
        type: Number,
        default: 0
    },
    isPinned: {
        type: Boolean,
        default: false
    },
    isEdited: {
        type: Boolean,
        default: false
    },
    editedAt: Date,
    tags: [String]
}, { timestamps: true });

// 3. COMMENT SCHEMA
const CommentSchema = new mongoose.Schema({
    postId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: [true, 'Comment content is required'],
        maxlength: 1000
    },
    parentCommentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment',
        default: null
    },
    likesCount: {
        type: Number,
        default: 0
    },
    repliesCount: {
        type: Number,
        default: 0
    },
    isEdited: {
        type: Boolean,
        default: false
    },
    mentions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
}, { timestamps: true });

// 4. LIKE SCHEMA
const LikeSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    postId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post'
    },
    commentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment'
    },
    type: {
        type: String,
        enum: ['like', 'love', 'haha', 'wow', 'sad', 'angry'],
        default: 'like'
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 60 * 60 * 24 * 365 // Auto-delete after 1 year
    }
}, { timestamps: true });

// Compound index for uniqueness
LikeSchema.index({ userId: 1, postId: 1 }, { unique: true, sparse: true });
LikeSchema.index({ userId: 1, commentId: 1 }, { unique: true, sparse: true });

// 5. CHAT SCHEMA (User-to-User Chat)
const ChatSchema = new mongoose.Schema({
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }],
    isGroupChat: {
        type: Boolean,
        default: false
    },
    groupName: {
        type: String,
        default: ''
    },
    groupAdmin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    groupImage: {
        type: String,
        default: ''
    },
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    },
    unreadCount: {
        type: Map,
        of: Number,
        default: {}
    }
}, { timestamps: true });

// 6. MESSAGE SCHEMA
const MessageSchema = new mongoose.Schema({
    chatId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chat',
        required: true
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: function() {
            return !this.imageUrl && !this.videoUrl;
        }
    },
    imageUrl: {
        type: String,
        default: ''
    },
    videoUrl: {
        type: String,
        default: ''
    },
    fileUrl: {
        type: String,
        default: ''
    },
    fileName: {
        type: String,
        default: ''
    },
    fileSize: {
        type: Number,
        default: 0
    },
    isRead: {
        type: Boolean,
        default: false
    },
    readBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    reactions: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        emoji: String,
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
        default: null
    },
    deletedFor: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
}, { timestamps: true });

// 7. AI CHAT SCHEMA (Chat with AI Assistant)
const AIChatSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    chatHistory: [{
        role: {
            type: String,
            enum: ['user', 'assistant', 'system'],
            required: true
        },
        content: {
            type: String,
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        isUserMessage: {
            type: Boolean,
            default: true
        }
    }],
    petInfo: {
        petName: String,
        petType: {
            type: String,
            enum: ['dog', 'cat', 'bird', 'fish', 'rabbit', 'other'],
            default: 'other'
        },
        petBreed: String,
        petAge: Number,
        healthConditions: [String],
        dietaryRestrictions: [String],
        medications: [String],
        vetInfo: {
            name: String,
            phone: String,
            address: String,
            lastVisit: Date
        }
    },
    preferences: {
        language: {
            type: String,
            default: 'en'
        },
        tone: {
            type: String,
            enum: ['friendly', 'professional', 'casual', 'enthusiastic'],
            default: 'friendly'
        },
        topics: [String],
        autoSave: {
            type: Boolean,
            default: true
        }
    },
    stats: {
        totalMessages: {
            type: Number,
            default: 0
        },
        aiResponses: {
            type: Number,
            default: 0
        },
        lastActive: {
            type: Date,
            default: Date.now
        },
        favoriteTopics: [String],
        frequentlyAsked: [{
            question: String,
            count: Number
        }]
    },
    settings: {
        reminders: {
            type: Boolean,
            default: true
        },
        healthTips: {
            type: Boolean,
            default: true
        },
        emergencyAlerts: {
            type: Boolean,
            default: true
        },
        dataSharing: {
            type: Boolean,
            default: false
        }
    }
}, { timestamps: true });

// 8. NOTIFICATION SCHEMA
const NotificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['like', 'comment', 'follow', 'mention', 'message', 'system', 'reminder'],
        required: true
    },
    fromUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    postId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post'
    },
    commentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment'
    },
    chatId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chat'
    },
    message: {
        type: String,
        required: true
    },
    isRead: {
        type: Boolean,
        default: false
    },
    actionUrl: String,
    metadata: mongoose.Schema.Types.Mixed
}, { timestamps: true });

// 9. PET HEALTH RECORD SCHEMA
const PetHealthSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    petName: {
        type: String,
        required: true
    },
    recordType: {
        type: String,
        enum: ['vaccination', 'medication', 'checkup', 'surgery', 'allergy', 'weight', 'other'],
        required: true
    },
    title: {
        type: String,
        required: true
    },
    description: String,
    date: {
        type: Date,
        required: true
    },
    vetName: String,
    vetClinic: String,
    location: String,
    documents: [{
        name: String,
        url: String,
        type: String
    }],
    reminders: [{
        date: Date,
        message: String,
        isCompleted: {
            type: Boolean,
            default: false
        }
    }],
    tags: [String],
    isRecurring: {
        type: Boolean,
        default: false
    },
    recurrence: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'yearly']
    }
}, { timestamps: true });

// 10. COMMUNITY EVENT SCHEMA
const EventSchema = new mongoose.Schema({
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true,
        maxlength: 200
    },
    description: {
        type: String,
        required: true,
        maxlength: 2000
    },
    location: {
        type: String,
        required: true
    },
    coordinates: {
        lat: Number,
        lng: Number
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    eventType: {
        type: String,
        enum: ['meetup', 'training', 'adoption', 'charity', 'workshop', 'competition', 'other'],
        default: 'meetup'
    },
    petTypes: [{
        type: String,
        enum: ['dog', 'cat', 'bird', 'fish', 'rabbit', 'all']
    }],
    images: [{
        url: String,
        caption: String
    }],
    attendees: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    maxAttendees: Number,
    isPublic: {
        type: Boolean,
        default: true
    },
    isCancelled: {
        type: Boolean,
        default: false
    },
    hashtags: [String],
    rules: [String]
}, { timestamps: true });

// Create Models
const User = mongoose.model('User', UserSchema);
const Post = mongoose.model('Post', PostSchema);
const Comment = mongoose.model('Comment', CommentSchema);
const Like = mongoose.model('Like', LikeSchema);
const Chat = mongoose.model('Chat', ChatSchema);
const Message = mongoose.model('Message', MessageSchema);
const AIChat = mongoose.model('AIChat', AIChatSchema);
const Notification = mongoose.model('Notification', NotificationSchema);
const PetHealth = mongoose.model('PetHealth', PetHealthSchema);
const Event = mongoose.model('Event', EventSchema);

// Database Helper Functions
const db = {
    // User Operations
    async createUser(userData) {
        try {
            const user = new User(userData);
            await user.save();
            return { success: true, user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    async findUserByEmail(email) {
        return await User.findOne({ email });
    },

    async findUserById(id) {
        return await User.findById(id).select('-password');
    },

    async updateUser(id, updateData) {
        return await User.findByIdAndUpdate(id, updateData, { new: true }).select('-password');
    },

    // Post Operations
    async createPost(postData) {
        try {
            const post = new Post(postData);
            await post.save();
            
            // Update user's post count
            await User.findByIdAndUpdate(postData.userId, { $inc: { postCount: 1 } });
            
            return { success: true, post };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    async getPosts(filter = {}, page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        const posts = await Post.find(filter)
            .populate('userId', 'name profilePic petName petType')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        
        const total = await Post.countDocuments(filter);
        return { posts, total, page, pages: Math.ceil(total / limit) };
    },

    // Comment Operations
    async addComment(commentData) {
        try {
            const comment = new Comment(commentData);
            await comment.save();
            
            // Update post comment count
            await Post.findByIdAndUpdate(commentData.postId, { $inc: { commentsCount: 1 } });
            
            // Create notification
            await this.createNotification({
                userId: commentData.userId,
                type: 'comment',
                postId: commentData.postId,
                fromUser: commentData.userId,
                message: 'commented on your post'
            });
            
            return { success: true, comment };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Like Operations
    async toggleLike(likeData) {
        try {
            const existingLike = await Like.findOne({
                userId: likeData.userId,
                postId: likeData.postId
            });

            if (existingLike) {
                await existingLike.deleteOne();
                await Post.findByIdAndUpdate(likeData.postId, { $inc: { likesCount: -1 } });
                return { success: true, liked: false };
            } else {
                const like = new Like(likeData);
                await like.save();
                await Post.findByIdAndUpdate(likeData.postId, { $inc: { likesCount: 1 } });
                
                // Create notification
                await this.createNotification({
                    userId: likeData.userId,
                    type: 'like',
                    postId: likeData.postId,
                    fromUser: likeData.userId,
                    message: 'liked your post'
                });
                
                return { success: true, liked: true, like };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Chat Operations
    async getOrCreateChat(user1Id, user2Id) {
        const participants = [user1Id, user2Id].sort();
        let chat = await Chat.findOne({ 
            participants: { $all: participants, $size: 2 },
            isGroupChat: false 
        });

        if (!chat) {
            chat = new Chat({
                participants,
                isGroupChat: false
            });
            await chat.save();
        }

        return chat;
    },

    async sendMessage(messageData) {
        try {
            const message = new Message(messageData);
            await message.save();
            
            // Update chat's last message
            await Chat.findByIdAndUpdate(messageData.chatId, {
                lastMessage: message._id,
                $inc: { [`unreadCount.${messageData.senderId}`]: 0 }
            });
            
            // Increment unread count for other participants
            const chat = await Chat.findById(messageData.chatId);
            chat.participants.forEach(participantId => {
                if (participantId.toString() !== messageData.senderId.toString()) {
                    chat.unreadCount.set(participantId.toString(), 
                        (chat.unreadCount.get(participantId.toString()) || 0) + 1);
                }
            });
            await chat.save();
            
            return { success: true, message };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // AI Chat Operations
    async getAIChat(userId) {
        let aiChat = await AIChat.findOne({ userId });
        
        if (!aiChat) {
            const user = await User.findById(userId);
            aiChat = new AIChat({
                userId,
                petInfo: {
                    petName: user.petName || '',
                    petType: user.petType || 'other'
                },
                chatHistory: [{
                    role: 'system',
                    content: `You are PetCare AI, a friendly and knowledgeable assistant for pet owners. The user's pet is named ${user.petName || 'their pet'} and is a ${user.petType || 'pet'}. Provide helpful, accurate, and compassionate advice.`
                }]
            });
            await aiChat.save();
        }
        
        return aiChat;
    },

    async addAIMessage(userId, role, content) {
        const aiChat = await this.getAIChat(userId);
        
        aiChat.chatHistory.push({
            role,
            content,
            isUserMessage: role === 'user'
        });
        
        aiChat.stats.totalMessages++;
        if (role === 'assistant') aiChat.stats.aiResponses++;
        aiChat.stats.lastActive = new Date();
        
        // Keep only last 50 messages to prevent overflow
        if (aiChat.chatHistory.length > 50) {
            aiChat.chatHistory = aiChat.chatHistory.slice(-50);
        }
        
        await aiChat.save();
        return aiChat;
    },

    // Notification Operations
    async createNotification(notificationData) {
        try {
            const notification = new Notification(notificationData);
            await notification.save();
            
            // Also add to user's notifications array
            await User.findByIdAndUpdate(notificationData.userId, {
                $push: {
                    notifications: {
                        type: notificationData.type,
                        fromUser: notificationData.fromUser,
                        postId: notificationData.postId,
                        message: notificationData.message,
                        read: false
                    }
                }
            });
            
            return { success: true, notification };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Search Operations
    async searchUsers(query, page = 1, limit = 20) {
        const regex = new RegExp(query, 'i');
        const skip = (page - 1) * limit;
        
        const users = await User.find({
            $or: [
                { name: regex },
                { email: regex },
                { petName: regex },
                { location: regex }
            ]
        })
        .select('name profilePic petName petType location bio')
        .skip(skip)
        .limit(limit);
        
        const total = await User.countDocuments({
            $or: [
                { name: regex },
                { email: regex },
                { petName: regex },
                { location: regex }
            ]
        });
        
        return { users, total, page, pages: Math.ceil(total / limit) };
    },

    async searchPosts(query, page = 1, limit = 20) {
        const regex = new RegExp(query, 'i');
        const skip = (page - 1) * limit;
        
        const posts = await Post.find({
            $or: [
                { content: regex },
                { hashtags: regex },
                { location: regex }
            ]
        })
        .populate('userId', 'name profilePic')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
        
        const total = await Post.countDocuments({
            $or: [
                { content: regex },
                { hashtags: regex },
                { location: regex }
            ]
        });
        
        return { posts, total, page, pages: Math.ceil(total / limit) };
    },

    // Statistics
    async getStatistics() {
        const [
            totalUsers,
            totalPosts,
            totalComments,
            totalLikes,
            activeUsers,
            newUsersToday
        ] = await Promise.all([
            User.countDocuments(),
            Post.countDocuments(),
            Comment.countDocuments(),
            Like.countDocuments(),
            User.countDocuments({ lastActive: { $gte: new Date(Date.now() - 24*60*60*1000) } }),
            User.countDocuments({ createdAt: { $gte: new Date().setHours(0,0,0,0) } })
        ]);

        return {
            totalUsers,
            totalPosts,
            totalComments,
            totalLikes,
            activeUsers,
            newUsersToday,
            engagementRate: totalPosts > 0 ? ((totalLikes + totalComments) / totalUsers).toFixed(2) : 0
        };
    },

    // Feed Generation
    async getUserFeed(userId, page = 1, limit = 10) {
        const user = await User.findById(userId);
        const following = user.following || [];
        
        // Get posts from followed users and user's own posts
        const feedPosts = await Post.find({
            $or: [
                { userId: { $in: following } },
                { userId: userId }
            ],
            visibility: { $in: ['public', 'friends'] }
        })
        .populate('userId', 'name profilePic petName petType')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);
        
        const total = await Post.countDocuments({
            $or: [
                { userId: { $in: following } },
                { userId: userId }
            ],
            visibility: { $in: ['public', 'friends'] }
        });
        
        return {
            posts: feedPosts,
            total,
            page,
            pages: Math.ceil(total / limit),
            hasMore: page < Math.ceil(total / limit)
        };
    },

    // Cleanup old data (cron job)
    async cleanupOldData() {
        const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        
        // Delete old notifications (older than 30 days)
        await Notification.deleteMany({
            createdAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
            isRead: true
        });
        
        // Delete old messages (older than 1 year)
        await Message.deleteMany({
            createdAt: { $lt: oneYearAgo },
            deletedFor: { $size: 2 }
        });
        
        // Delete inactive users (never logged in, older than 6 months)
        const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
        await User.deleteMany({
            lastActive: { $lt: sixMonthsAgo },
            isVerified: false,
            postCount: 0
        });
        
        return { success: true, message: 'Cleanup completed' };
    }
};

// Export everything
export {
    connectDB,
    User,
    Post,
    Comment,
    Like,
    Chat,
    Message,
    AIChat,
    Notification,
    PetHealth,
    Event,
    db
};
