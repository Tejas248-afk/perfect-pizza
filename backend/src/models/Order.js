// src/models/Order.js
const mongoose = require('mongoose');

const { Schema } = mongoose;

const SIZE_TYPES = ['REGULAR', 'MEDIUM', 'LARGE'];

const orderItemAddOnSchema = new Schema(
  {
    name: String,
    price: { type: Number, min: 0 },
    quantity: { type: Number, default: 1, min: 1 },
  },
  { _id: false }
);

// Combo ke andar ke items (old, legacy use)
const comboItemSchema = new Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  { _id: false }
);

// NEW: comboSelections – frontend se aane wali exact selection
const comboSelectionSchema = new Schema(
  {
    groupKey: {
      type: String,
      trim: true,
    },
    groupTitle: {
      type: String,
      trim: true,
    },
    label: {
      type: String,
      trim: true,
    },
    extraPrice: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  { _id: false }
);

const orderItemSchema = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    productName: String,
    image: String,
    category: String,
    isVeg: Boolean,

    // LEGACY
    comboItems: [comboItemSchema],

    // NEW
    comboSelections: [comboSelectionSchema],

    size: {
      name: { type: String, enum: SIZE_TYPES },
      price: { type: Number, min: 0 },
    },

    crust: {
      name: String,
      price: { type: Number, min: 0 },
    },

    addOns: [orderItemAddOnSchema],

    quantity: { type: Number, required: true, min: 1 },

    unitPrice: { type: Number, required: true, min: 0 },
    itemTotal: { type: Number, required: true, min: 0 },

    notes: String,
  },
  { _id: false }
);

const deliverySchema = new Schema(
  {
    deliveryType: {
      type: String,
      enum: ['DELIVERY', 'PICKUP'],
      required: true,
    },
    address: String,
    landmark: String,
    latitude: Number,
    longitude: Number,
    distance: Number,
  },
  { _id: false }
);

const paymentSchema = new Schema(
  {
    paymentType: {
      type: String,
      enum: ['COD', 'PAYU'],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'],
      default: 'PENDING',
    },
    paymentReference: String,
    payuOrderId: String,
    payuTxnId: String,
    rawGatewayResponse: {
      type: Schema.Types.Mixed,
    },
  },
  { _id: false }
);

// Order ke possible statuses
const ORDER_STATUS = [
  'PENDING_PAYMENT',
  'PLACED',
  'BAKING',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
];

const orderSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    outlet: {
      type: Schema.Types.ObjectId,
      ref: 'Outlet',
    },

    outletName: {
      type: String,
      trim: true,
    },

    items: {
      type: [orderItemSchema],
      validate: (v) =>
        Array.isArray(v) && v.length > 0,
    },

    delivery: deliverySchema,

    subtotal: {
      type: Number,
      min: 0,
      required: true,
    },

    offerDiscount: {
      type: Number,
      min: 0,
      default: 0,
    },

    deliveryFee: {
      type: Number,
      min: 0,
      default: 0,
    },

    taxAmount: {
      type: Number,
      min: 0,
      default: 0,
    },

    couponCode: {
      type: String,
      trim: true,
    },

    couponDiscount: {
      type: Number,
      min: 0,
      default: 0,
    },

    rewardCoinsUsed: {
      type: Number,
      min: 0,
      default: 0,
    },

    rewardDiscount: {
      type: Number,
      min: 0,
      default: 0,
    },

    grandTotal: {
      type: Number,
      min: 0,
      required: true,
    },

    rewardCoinsEarned: {
      type: Number,
      min: 0,
      default: 0,
    },

    placedAt: Date,
    bakingAt: Date,
    outForDeliveryAt: Date,
    deliveredAt: Date,
    cancelledAt: Date,

    payment: paymentSchema,

    status: {
      type: String,
      enum: ORDER_STATUS,
      default: 'PLACED',
    },

    // ✅ NEW: admin acceptance + prep time
    isAcceptedByAdmin: {
      type: Boolean,
      default: false,
    },

    acceptedAt: {
      type: Date,
      default: null,
    },

    kitchenPrepMinutes: {
      type: Number,
      default: null,
      min: 0,
    },
  },
  { timestamps: true }
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });

const Order = mongoose.model('Order', orderSchema);
Order.STATUS = ORDER_STATUS;

// Optional transition map (agar kahin use ho)
const ALLOWED_TRANSITIONS = {
  PENDING_PAYMENT: ['CANCELLED'], // manual cancel allowed
  PLACED: ['BAKING', 'CANCELLED'],
  BAKING: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

Order.canTransition = function (fromStatus, toStatus) {
  const allowed = ALLOWED_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
};

module.exports = Order;