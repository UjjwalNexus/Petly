// src/routes/v1/chat.routes.js
const express = require('express');
const router = express.Router();
const chatController = require('../../controllers/chat.controller');
const { auth } = require('../../middleware/auth.middleware');
const { validate, schemas } = require('../../middleware/validation.middleware');

router.post('/message', auth, validate(schemas.sendMessage), chatController.sendMessage);
router.get('/community/:communityId', auth, chatController.getCommunityMessages);
router.get('/dm/:userId', auth, chatController.getDirectMessages);
router.post('/message/:messageId/read', auth, chatController.markAsRead);
router.delete('/message/:messageId', auth, chatController.deleteMessage);
router.post('/message/:messageId/reaction', auth, chatController.addReaction);
router.delete('/message/:messageId/reaction', auth, chatController.removeReaction);
router.get('/unread', auth, chatController.getUnreadCount);

module.exports = router;