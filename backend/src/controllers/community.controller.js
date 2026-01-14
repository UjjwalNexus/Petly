// src/controllers/community.controller.js
const communityService = require('../services/community.service');
const asyncHandler = require('../utils/helpers/asyncHandler');
const ApiResponse = require('../utils/helpers/apiResponse');

const createCommunity = asyncHandler(async (req, res) => {
  const community = await communityService.createCommunity(req.body, req.user._id);
  
  ApiResponse.created(res, 'Community created successfully', {
    community: community.toJSON()
  });
});

const getCommunities = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, sort = '-createdAt', search = '', privacy } = req.query;
  
  const filters = {};
  if (privacy) filters.privacy = privacy;
  
  const pagination = { page, limit, sort, search };
  const result = await communityService.getCommunities(filters, pagination);
  
  ApiResponse.paginated(res, 'Communities retrieved successfully', result.communities, result.pagination);
});

const getCommunity = asyncHandler(async (req, res) => {
  const { communityId } = req.params;
  const community = await communityService.getCommunityById(communityId, true);
  
  ApiResponse.success(res, 'Community retrieved successfully', {
    community: community.toJSON()
  });
});

const updateCommunity = asyncHandler(async (req, res) => {
  const { communityId } = req.params;
  const community = await communityService.updateCommunity(communityId, req.body, req.user._id);
  
  ApiResponse.success(res, 'Community updated successfully', {
    community: community.toJSON()
  });
});

const deleteCommunity = asyncHandler(async (req, res) => {
  const { communityId } = req.params;
  const community = await communityService.deleteCommunity(communityId, req.user._id);
  
  ApiResponse.success(res, 'Community deleted successfully', {
    community: community.toJSON()
  });
});

const joinCommunity = asyncHandler(async (req, res) => {
  const { communityId } = req.params;
  const community = await communityService.joinCommunity(communityId, req.user._id);
  
  ApiResponse.success(res, 'Joined community successfully', {
    community: community.toJSON()
  });
});

const leaveCommunity = asyncHandler(async (req, res) => {
  const { communityId } = req.params;
  const community = await communityService.leaveCommunity(communityId, req.user._id);
  
  ApiResponse.success(res, 'Left community successfully', {
    community: community.toJSON()
  });
});

const addModerator = asyncHandler(async (req, res) => {
  const { communityId, userId } = req.params;
  const community = await communityService.addModerator(communityId, userId, req.user._id);
  
  ApiResponse.success(res, 'Moderator added successfully', {
    community: community.toJSON()
  });
});

const removeModerator = asyncHandler(async (req, res) => {
  const { communityId, userId } = req.params;
  const community = await communityService.removeModerator(communityId, userId, req.user._id);
  
  ApiResponse.success(res, 'Moderator removed successfully', {
    community: community.toJSON()
  });
});

module.exports = {
  createCommunity,
  getCommunities,
  getCommunity,
  updateCommunity,
  deleteCommunity,
  joinCommunity,
  leaveCommunity,
  addModerator,
  removeModerator
};