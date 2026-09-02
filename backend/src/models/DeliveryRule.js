const mongoose = require('mongoose');

const { Schema } = mongoose;

const deliveryRuleSchema = new Schema(
  {
    minDistance: {
      type: Number, // in KM
      required: true,
      min: 0
    },
    maxDistance: {
      type: Number,
      required: true,
      min: 0
    },
    minCartValueForFreeDelivery: {
      type: Number,
      required: true,
      min: 0
    },
    baseDeliveryFee: {
      type: Number,
      required: true,
      min: 0
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

deliveryRuleSchema.index({ minDistance: 1, maxDistance: 1, isActive: 1 });

module.exports = mongoose.model('DeliveryRule', deliveryRuleSchema);