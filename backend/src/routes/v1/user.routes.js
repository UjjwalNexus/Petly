// src/routes/v1/user.routes.js
const express = require('express');
const router = express.Router();
const userController = require('../../controllers/user.controller');
const { auth } = require('../../middleware/auth.middleware');
const { validate, schemas } = require('../../middleware/validation.middleware');

router.get('/profile', auth, userController.getProfile);
router.put('/profile', auth, validate(schemas.updateProfile), userController.updateProfile);
router.get('/profile/:userId', userController.getUserProfile);
router.get('/communities', auth, userController.getUserCommunities);
router.get('/activity', auth, userController.getUserActivity);

module.exports = router;