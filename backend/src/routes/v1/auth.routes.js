// src/routes/v1/auth.routes.js
const express = require('express');
const router = express.Router();
const authController = require('../../controllers/auth.controller');
const { validate, schemas } = require('../../middleware/validation.middleware');

router.post('/register', validate(schemas.register), authController.register);
router.post('/login', validate(schemas.login), authController.login);
router.post('/logout', authController.logout);
router.post('/refresh-tokens', authController.refreshTokens);
router.post('/forgot-password', validate(schemas.forgotPassword), authController.forgotPassword);
router.post('/reset-password', validate(schemas.resetPassword), authController.resetPassword);

module.exports = router;