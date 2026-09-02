const mongoose = require('mongoose');

const { Schema } = mongoose;

const USER_ROLES = {
  CUSTOMER: 'CUSTOMER',
  ADMIN: 'ADMIN',
  KITCHEN: 'KITCHEN'
};

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    contact: {
      type: String,
      required: true,
      unique: true, // yahi unique index kaafi hai
      trim: true
    },
    password: {
      type: String,
      required: true,
      minlength: 8
    },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      default: USER_ROLES.CUSTOMER
    },
    rewardCoins: {
      type: Number,
      default: 0,
      min: 0
    },
    isActive: {
      type: Boolean,
      default: true
    },

    // Failed login protection
    loginAttempts: {
      type: Number,
      default: 0,
      min: 0
    },
    lockUntil: {
      type: Date,
      default: null
    },

    // OTP login support (CUSTOMER only)
    otpCode: {
      type: String
    },
    otpExpiresAt: {
      type: Date
    }
  },
  { timestamps: true }
);

// Yahan pehle userSchema.index({ contact: 1 }, { unique: true }); tha
// usko hata diya taaki duplicate index warning na aaye.

const User = mongoose.model('User', userSchema);
User.ROLES = USER_ROLES;

module.exports = User;