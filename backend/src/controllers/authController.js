const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const User = require('../models/User');
const { sendOtpSms } = require('../services/smsService');

// ---------- Validation Schemas ----------

const signupSchema = Joi.object({
  name: Joi.string().min(2).max(60).required(),
  contact: Joi.string().min(6).max(20).required(),
  password: Joi.string()
    .min(8)
    .max(64)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)
    .message(
      'Password must be at least 8 characters and include uppercase, lowercase and a number.'
    )
    .required()
});

const loginSchema = Joi.object({
  contact: Joi.string().min(6).max(20).required(),
  password: Joi.string().required()
});

const otpSendSchema = Joi.object({
  contact: Joi.string().min(6).max(20).required()
});

const otpVerifySchema = Joi.object({
  contact: Joi.string().min(6).max(20).required(),
  otp: Joi.string().min(4).max(6).required()
});

// ---------- Helpers ----------

const createToken = user => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    }
  );
};

function generateRandomPassword() {
  // Strong random password (12+ chars)
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let pwd = '';
  for (let i = 0; i < 12; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Ensure at least 1 uppercase, 1 lowercase, 1 digit
  pwd += 'Aa1';
  return pwd;
}

// ---------- Controllers ----------

// POST /api/auth/signup  (primarily for internal / future use)
exports.signup = async (req, res) => {
  try {
    console.log('Signup body:', req.body);
    const { error, value } = signupSchema.validate(req.body || {}, {
      abortEarly: false
    });

    if (error) {
      return res
        .status(400)
        .json({ message: error.details[0].message, details: error.details });
    }

    const { name, contact, password } = value;

    // Duplicate check
    const existing = await User.findOne({ contact });
    if (existing) {
      return res.status(400).json({
        message: 'An account with this contact number already exists.'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      contact,
      password: hashed,
      role: User.ROLES.CUSTOMER // force CUSTOMER
    });

    const token = createToken(user);

    const userData = {
      id: user._id,
      name: user.name,
      contact: user.contact,
      role: user.role,
      rewardCoins: user.rewardCoins
    };

    return res.status(201).json({
      message: 'Signup successful.',
      token,
      user: userData
    });
  } catch (err) {
    console.error('Signup error:', err);
    return res
      .status(500)
      .json({
        message: 'Unable to sign up right now. Please try again in a while.'
      });
  }
};

// POST /api/auth/login  (STAFF: ADMIN / KITCHEN)
exports.login = async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body || {}, {
      abortEarly: false
    });

    if (error) {
      return res
        .status(400)
        .json({ message: error.details[0].message, details: error.details });
    }

    const { contact, password } = value;

    const user = await User.findOne({ contact });
    if (!user) {
      return res.status(400).json({ message: 'Invalid contact or password.' });
    }

    // Customers must use OTP login, not staff login
    if (user.role === User.ROLES.CUSTOMER) {
      return res.status(403).json({
        message:
          'Please use mobile OTP for customer login (use the "Customer (OTP)" tab).'
      });
    }

    if (!user.isActive) {
      return res
        .status(403)
        .json({ message: 'This account is inactive. Please contact support.' });
    }

    // Account lock check
    if (user.lockUntil && user.lockUntil > new Date()) {
      return res.status(429).json({
        message:
          'Too many failed login attempts. Please try again after some time.'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      user.loginAttempts += 1;

      if (user.loginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min lock
        user.loginAttempts = 0;
      }

      await user.save();
      return res
        .status(400)
        .json({ message: 'Invalid contact or password.' });
    }

    // successful login => reset attempts
    user.loginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    const token = createToken(user);

    const userData = {
      id: user._id,
      name: user.name,
      contact: user.contact,
      role: user.role,
      rewardCoins: user.rewardCoins
    };

    return res.json({
      message: 'Login successful.',
      token,
      user: userData
    });
  } catch (err) {
    console.error('Login error:', err);
    return res
      .status(500)
      .json({
        message: 'Unable to log in right now. Please try again in a while.'
      });
  }
};

// POST /api/auth/customer/send-otp
exports.sendCustomerOtp = async (req, res) => {
  try {
    const { error, value } = otpSendSchema.validate(req.body || {}, {
      abortEarly: false
    });

    if (error) {
      return res
        .status(400)
        .json({ message: error.details[0].message, details: error.details });
    }

    const { contact } = value;

    let user = await User.findOne({ contact });

    // New customer → auto create
    if (!user) {
      const randomPassword = generateRandomPassword();
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(randomPassword, salt);

      const tempName =
        'Customer ' + contact.slice(-4).padStart(4, 'X');

      user = await User.create({
        name: tempName,
        contact,
        password: hashed,
        role: User.ROLES.CUSTOMER
      });
    }

    if (!user.isActive) {
      return res
        .status(403)
        .json({ message: 'This account is inactive. Please contact support.' });
    }

    const otp = String(
      Math.floor(100000 + Math.random() * 900000)
    ); // 6-digit OTP

    user.otpCode = otp;
    user.otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    user.loginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    await sendOtpSms(contact, otp);

    return res.json({
      message: 'OTP has been sent to your mobile number.'
    });
  } catch (err) {
    console.error('sendCustomerOtp error:', err);
    return res
      .status(500)
      .json({
        message: 'Unable to send OTP right now. Please try again later.'
      });
  }
};

// POST /api/auth/customer/verify-otp
exports.verifyCustomerOtp = async (req, res) => {
  try {
    const { error, value } = otpVerifySchema.validate(req.body || {}, {
      abortEarly: false
    });

    if (error) {
      return res
        .status(400)
        .json({ message: error.details[0].message, details: error.details });
    }

    const { contact, otp } = value;

    const user = await User.findOne({
      contact,
      role: User.ROLES.CUSTOMER
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid OTP or contact.' });
    }

    if (!user.isActive) {
      return res
        .status(403)
        .json({ message: 'This account is inactive. Please contact support.' });
    }

    if (!user.otpCode || !user.otpExpiresAt) {
      return res.status(400).json({
        message: 'OTP was not requested or has expired. Please request a new OTP.'
      });
    }

    if (user.otpExpiresAt < new Date()) {
      return res.status(400).json({
        message: 'OTP has expired. Please request a new OTP.'
      });
    }

    if (user.otpCode !== otp) {
      return res.status(400).json({ message: 'Invalid OTP.' });
    }

    // OTP correct
    user.otpCode = null;
    user.otpExpiresAt = null;
    user.loginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    const token = createToken(user);

    const userData = {
      id: user._id,
      name: user.name,
      contact: user.contact,
      role: user.role,
      rewardCoins: user.rewardCoins
    };

    return res.json({
      message: 'Login successful.',
      token,
      user: userData
    });
  } catch (err) {
    console.error('verifyCustomerOtp error:', err);
    return res
      .status(500)
      .json({
        message: 'Unable to verify OTP right now. Please try again later.'
      });
  }
};

// POST /api/auth/logout
exports.logout = async (req, res) => {
  try {
    return res.json({ message: 'Logged out successfully.' });
  } catch (err) {
    console.error('Logout error:', err);
    return res
      .status(500)
      .json({
        message: 'Unable to log out right now. Please try again later.'
      });
  }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    return res.json({
      user: {
        id: req.user._id,
        name: req.user.name,
        contact: req.user.contact,
        role: req.user.role,
        rewardCoins: req.user.rewardCoins,
        createdAt: req.user.createdAt
      }
    });
  } catch (err) {
    console.error('/me error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to fetch profile right now.' });
  }
};