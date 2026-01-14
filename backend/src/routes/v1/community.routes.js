// src/routes/v1/community.routes.js
const express = require('express');
const router = express.Router();
const communityController = require('../../controllers/community.controller');
const { auth, communityAdmin } = require('../../middleware/auth.middleware');
const { validate, schemas } = require('../../middleware/validation.middleware');

router.post('/', auth, validate(schemas.createCommunity), communityController.createCommunity);
router.get('/', communityController.getCommunities);
router.get('/:communityId', communityController.getCommunity);
router.put('/:communityId', auth, communityAdmin, validate(schemas.updateCommunity), communityController.updateCommunity);
router.delete('/:communityId', auth, communityAdmin, communityController.deleteCommunity);
router.post('/:communityId/join', auth, communityController.joinCommunity);
router.post('/:communityId/leave', auth, communityController.leaveCommunity);
router.post('/:communityId/moderators', auth, communityAdmin, communityController.addModerator);
router.delete('/:communityId/moderators/:userId', auth, communityAdmin, communityController.removeModerator);

module.exports = router;