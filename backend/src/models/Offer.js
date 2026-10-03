// src/models/Offer.js
const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, trim: true, uppercase: true },

    description: { type: String },

    discountType: {
      type: String,
      enum: ['PERCENT', 'FLAT', 'B1G1'],
      required: true,
      default: 'PERCENT',
    },
    discountValue: { type: Number },     // PERCENT/FLAT ke liye
    minOrderAmount: { type: Number },
    maxDiscount: { type: Number },       // PERCENT ke liye (optional)

    validFrom: { type: Date },
    validTo: { type: Date },
    daysOfWeek: [{ type: Number }],      // 0 = Sun ... 6 = Sat

    firstOrderOnly: { type: Boolean, default: false },
    inactiveOnly: { type: Boolean, default: false },
    happyHour: { type: Boolean, default: false },
    rainyDay: { type: Boolean, default: false },

    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Offer', offerSchema);