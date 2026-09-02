const mongoose = require('mongoose');

const { Schema } = mongoose;

const outletSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    address: {
      type: String,
      trim: true
    },
    city: {
      type: String,
      trim: true
    },
    lat: {
      type: Number,
      required: true
    },
    lng: {
      type: Number,
      required: true
    },
    deliveryRadiusKm: {
      type: Number,
      default: 5,
      min: 0
    },
    openHour: {
      type: Number, // 0–23
      default: 10
    },
    closeHour: {
      type: Number, // 0–23
      default: 23
    },
    phoneNumbers: [
      {
        type: String,
        trim: true
      }
    ],
    isActive: {
      type: Boolean,
      default: true
    },
    settings: {
      enableOnlineOrders: {
        type: Boolean,
        default: true
      },
      enableBogoTuesday: {
        type: Boolean,
        default: true
      }
    }
  },
  { timestamps: true }
);

outletSchema.index({ code: 1 }, { unique: true });

module.exports = mongoose.model('Outlet', outletSchema);