const mongoose = require('mongoose');

const { Schema } = mongoose;

const couponSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    description: {
      type: String,
      trim: true
    },
    // PERCENT = X% off, FLAT = ₹X off
    discountType: {
      type: String,
      enum: ['PERCENT', 'FLAT'],
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    minCartAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    maxDiscount: {
      type: Number,
      default: 0, // 0 = no cap
      min: 0
    },

    // Date range (optional)
    validFrom: {
      type: Date,
      default: null
    },
    validTo: {
      type: Date,
      default: null
    },

    // Days of week allowed (0=Sun ... 6=Sat). Empty = all days
    daysOfWeek: [
      {
        type: Number,
        min: 0,
        max: 6
      }
    ],

    // Time-of-day window (24 hr). Null = no limit
    startHour: {
      type: Number,
      min: 0,
      max: 23,
      default: null
    },
    endHour: {
      type: Number,
      min: 0,
      max: 23,
      default: null
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

couponSchema.index({ code: 1 }, { unique: true });

module.exports = mongoose.model('Coupon', couponSchema);