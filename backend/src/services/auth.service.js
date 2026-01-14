// services/auth.service.js
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User.model');
const Token = require('../models/Token.model');
const ApiError = require('../utils/helpers/apiError');
const logger = require('../config/logger');
const emailService = require('./email.service');

class AuthService {
  constructor() {
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET;
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET;
    this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '15m';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';
  }

  async registerUser(userData, ipAddress, userAgent) {
    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: userData.email }, { username: userData.username }]
    });

    if (existingUser) {
      throw new ApiError('User already exists with this email or username', 409);
    }

    // Create user
    const user = await User.create(userData);

    // Generate tokens
    const tokens = await this.generateTokens(user, ipAddress, userAgent);

    // Send verification email
    await emailService.sendVerificationEmail(user.email, user._id);

    logger.info(`User registered: ${user.email}`);
    return { user, tokens };
  }

  async loginUser(email, password, ipAddress, userAgent) {
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      throw new ApiError('Invalid credentials', 401);
    }

    // Check if account is locked
    if (user.isLocked()) {
      throw new ApiError('Account is temporarily locked', 423);
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      // Increment login attempts
      user.loginAttempts += 1;
      
      // Lock account after 5 failed attempts
      if (user.loginAttempts >= 5) {
        user.lockUntil = Date.now() + 15 * 60 * 1000; // 15 minutes
      }
      
      await user.save();
      throw new ApiError('Invalid credentials', 401);
    }

    // Reset login attempts on successful login
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    // Generate tokens
    const tokens = await this.generateTokens(user, ipAddress, userAgent);

    logger.info(`User logged in: ${user.email}`);
    return { user, tokens };
  }

  async generateTokens(user, ipAddress, userAgent) {
    const accessToken = jwt.sign(
      { userId: user._id, role: user.role },
      this.accessTokenSecret,
      { expiresIn: this.accessTokenExpiry }
    );

    const refreshToken = crypto.randomBytes(40).toString('hex');
    const refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Save refresh token to database
    await Token.create({
      userId: user._id,
      token: refreshToken,
      type: 'refresh',
      expiresAt: refreshTokenExpiry,
      ipAddress,
      userAgent
    });

    return {
      access: { token: accessToken, expiresIn: this.accessTokenExpiry },
      refresh: { token: refreshToken, expiresAt: refreshTokenExpiry }
    };
  }

  async verifyToken(token, type = 'access') {
    try {
      const secret = type === 'access' ? this.accessTokenSecret : this.refreshTokenSecret;
      const decoded = jwt.verify(token, secret);
      
      // Check if token is blacklisted
      const tokenDoc = await Token.findOne({ token, type, blacklisted: true });
      if (tokenDoc) {
        throw new Error('Token is blacklisted');
      }

      return decoded;
    } catch (error) {
      throw new ApiError('Invalid token', 401);
    }
  }

  async refreshAuth(refreshToken) {
    // Find and validate refresh token
    const tokenDoc = await Token.findOne({
      token: refreshToken,
      type: 'refresh',
      blacklisted: false,
      expiresAt: { $gt: new Date() }
    });

    if (!tokenDoc) {
      throw new ApiError('Invalid refresh token', 401);
    }

    // Get user
    const user = await User.findById(tokenDoc.userId);
    if (!user) {
      throw new ApiError('User not found', 404);
    }

    // Blacklist the old refresh token
    tokenDoc.blacklisted = true;
    await tokenDoc.save();

    // Generate new tokens
    const newAccessToken = jwt.sign(
      { userId: user._id, role: user.role },
      this.accessTokenSecret,
      { expiresIn: this.accessTokenExpiry }
    );

    const newRefreshToken = crypto.randomBytes(40).toString('hex');
    const refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await Token.create({
      userId: user._id,
      token: newRefreshToken,
      type: 'refresh',
      expiresAt: refreshTokenExpiry,
      ipAddress: tokenDoc.ipAddress,
      userAgent: tokenDoc.userAgent
    });

    return {
      access: { token: newAccessToken, expiresIn: this.accessTokenExpiry },
      refresh: { token: newRefreshToken, expiresAt: refreshTokenExpiry }
    };
  }

  async logoutUser(refreshToken, accessToken) {
    // Blacklist refresh token
    if (refreshToken) {
      await Token.findOneAndUpdate(
        { token: refreshToken, type: 'refresh' },
        { blacklisted: true }
      );
    }

    // Optionally blacklist access token
    if (accessToken) {
      const decoded = jwt.decode(accessToken);
      if (decoded && decoded.exp) {
        await Token.create({
          userId: decoded.userId,
          token: accessToken,
          type: 'access',
          expiresAt: new Date(decoded.exp * 1000),
          blacklisted: true
        });
      }
    }
  }

  async updateUserStatus(userId, isOnline) {
    await User.findByIdAndUpdate(userId, {
      'status.isOnline': isOnline,
      'status.lastSeen': new Date()
    });
  }

  async forgotPassword(email) {
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal that user doesn't exist
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpiry;
    await user.save();

    await emailService.sendPasswordResetEmail(user.email, resetToken);
  }

  async resetPassword(token, newPassword) {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      throw new ApiError('Invalid or expired reset token', 400);
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    // Send confirmation email
    await emailService.sendPasswordResetConfirmation(user.email);
  }
}

module.exports = new AuthService();