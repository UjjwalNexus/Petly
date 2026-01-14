// src/routes/index.js
const express = require('express');
const router = express.Router();

const authRoutes = require('./v1/auth.routes');
const userRoutes = require('./v1/user.routes');
const communityRoutes = require('./v1/community.routes');
const postRoutes = require('./v1/post.routes');
const chatRoutes = require('./v1/chat.routes');

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/communities', communityRoutes);
router.use('/posts', postRoutes);
router.use('/chat', chatRoutes);

module.exports = router;