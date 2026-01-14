// controllers/auth.controller.js
const authService = require('../services/auth.service');
const asyncHandler = require('../utils/helpers/asyncHandler');
const ApiResponse = require('../utils/helpers/apiResponse');
const logger = require('../config/logger');

const register = asyncHandler(async (req, res) => {
  const userData = req.body;
  const ipAddress = req.ip;
  const userAgent = req.headers['user-agent'];
  
  const { user, tokens } = await authService.registerUser(userData, ipAddress, userAgent);
  
  // Set refresh token as HTTP-only cookie
  res.cookie('refreshToken', tokens.refresh.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
  
  ApiResponse.success(res, 'Registration successful', {
    user: user.toJSON(),
    accessToken: tokens.access.token
  }, 201);
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const ipAddress = req.ip;
  const userAgent = req.headers['user-agent'];
  
  const { user, tokens } = await authService.loginUser(email, password, ipAddress, userAgent);
  
  // Update user status to online
  await authService.updateUserStatus(user._id, true);
  
  res.cookie('refreshToken', tokens.refresh.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
  
  ApiResponse.success(res, 'Login successful', {
    user: user.toJSON(),
    accessToken: tokens.access.token
  });
});

const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  const accessToken = req.headers.authorization?.replace('Bearer ', '');
  
  await authService.logoutUser(refreshToken, accessToken);
  
  // Update user status to offline
  await authService.updateUserStatus(req.user._id, false);
  
  res.clearCookie('refreshToken');
  ApiResponse.success(res, 'Logout successful');
});

const refreshTokens = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  
  if (!refreshToken) {
    throw new ApiError('Refresh token is required', 401);
  }
  
  const tokens = await authService.refreshAuth(refreshToken);
  
  res.cookie('refreshToken', tokens.refresh.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
  
  ApiResponse.success(res, 'Tokens refreshed', {
    accessToken: tokens.access.token
  });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  
  await authService.forgotPassword(email);
  
  ApiResponse.success(res, 'Password reset email sent');
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  
  await authService.resetPassword(token, password);
  
  ApiResponse.success(res, 'Password reset successful');
});

module.exports = {
  register,
  login,
  logout,
  refreshTokens,
  forgotPassword,
  resetPassword
};