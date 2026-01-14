// src/routes/v1/post.routes.js
const express = require('express');
const router = express.Router();
const postController = require('../../controllers/post.controller');
const { auth } = require('../../middleware/auth.middleware');
const { validate, schemas } = require('../../middleware/validation.middleware');

router.post('/', auth, validate(schemas.createPost), postController.createPost);
router.get('/community/:communityId', postController.getCommunityPosts);
router.get('/:postId', postController.getPost);
router.put('/:postId', auth, postController.updatePost);
router.delete('/:postId', auth, postController.deletePost);
router.post('/:postId/upvote', auth, postController.upvotePost);
router.post('/:postId/downvote', auth, postController.downvotePost);
router.post('/:postId/pin', auth, postController.pinPost);
router.post('/:postId/unpin', auth, postController.unpinPost);
router.get('/search', postController.searchPosts);

module.exports = router;