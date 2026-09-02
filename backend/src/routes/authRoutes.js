const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Login par stricter rate limit (Failed login protection ka part)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes per IP
  message: {
    message:
      'Too many login attempts from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// OTP send limit (customer)
const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5,
  message: {
    message: 'Too many OTP requests, please wait and try again.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// @route   POST /api/auth/signup  (legacy / optional)
router.post('/signup', authController.signup);

// @route   POST /api/auth/login  (STAFF: ADMIN & KITCHEN)
router.post('/login', loginLimiter, authController.login);

// @route   POST /api/auth/customer/send-otp  (CUSTOMER)
router.post(
  '/customer/send-otp',
  otpLimiter,
  authController.sendCustomerOtp
);

// @route   POST /api/auth/customer/verify-otp  (CUSTOMER)
router.post('/customer/verify-otp', authController.verifyCustomerOtp);

// @route   POST /api/auth/logout
router.post('/logout', authMiddleware, authController.logout);

// @route   GET /api/auth/me
router.get('/me', authMiddleware, authController.getMe);

module.exports = router;