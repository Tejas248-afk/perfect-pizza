// src/models/DeliveryZone.js
const mongoose = require('mongoose');

const deliveryZoneSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    centerLat: { type: Number, required: true },
    centerLng: { type: Number, required: true },

    radiusKm: { type: Number, required: true, min: 0 },

    baseFee: { type: Number, required: true, min: 0, default: 0 },
    freeDeliveryThreshold: { type: Number, min: 0 },

    codAllowed: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DeliveryZone', deliveryZoneSchema);