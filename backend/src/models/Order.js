// src/models/Order.js
const mongoose = require('mongoose');

const { Schema } = mongoose;

const SIZE_TYPES = ['REGULAR', 'MEDIUM', 'LARGE'];

const orderItemAddOnSchema = new Schema(
  {
    name: String,
    price: { type: Number, min: 0 },
    quantity: { type: Number, default: 1, min: 1 }
  },
  { _id: false }
);

// Combo ke andar ke items (old, legacy use)
// e.g. ["Pizza", "Burger", "Drink"] etc – agar kahin use ho raha ho to rehne do
const comboItemSchema = new Schema(
  {
    name: {
      type: String,
      trim: true
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1
    }
  },
  { _id: false }
);

// NEW: comboSelections – frontend se aane wali exact selection
// e.g. { groupTitle: "Pizza", label: "Paneer Onion Pizza" }
const comboSelectionSchema = new Schema(
  {
    groupKey: {
      type: String,
      trim: true
    },
    groupTitle: {
      type: String,
      trim: true
    },
    label: {
      type: String,
      trim: true
    },
    extraPrice: {
      type: Number,
      min: 0,
      default: 0
    }
  },
  { _id: false }
);

const orderItemSchema = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    productName: String,
    image: String,
    category: String,
    isVeg: Boolean,

    // LEGACY: agar pehle se kuch use ho raha ho to
    comboItems: [comboItemSchema],

    // NEW: combo detail exactly jaisa customer ne choose kiya
    // Example:
    // [
    //   { groupTitle: "Pizza", label: "Paneer Onion Pizza" },
    //   { groupTitle: "Side", label: "Burger" },
    //   { groupTitle: "Beverages", label: "ColdDrink 250ml" }
    // ]
    comboSelections: [comboSelectionSchema],

    size: {
      name: { type: String, enum: SIZE_TYPES },
      price: { type: Number, min: 0 }
    },

    crust: {
      name: String,
      price: { type: Number, min: 0 }
    },

    addOns: [orderItemAddOnSchema],

    quantity: { type: Number, required: true, min: 1 },

    unitPrice: { type: Number, required: true, min: 0 },
    itemTotal: { type: Number, required: true, min: 0 },

    notes: String
  },
  { _id: false }
);

const deliverySchema = new Schema(
  {
    deliveryType: {
      type: String,
      enum: ['DELIVERY', 'PICKUP'],
      required: true
    },
    address: String,
    landmark: String,
    latitude: Number,
    longitude: Number,
    distance: Number
  },
  { _id: false }
);

const paymentSchema = new Schema(
  {
    paymentType: {
      type: String,
      enum: ['COD', 'PAYU'],
      required: true
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'],
      default: 'PENDING'
    },
    paymentReference: String,
    payuOrderId: String,
    payuTxnId: String,
    rawGatewayResponse: {
      type: Schema.Types.Mixed
    }
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
  'CANCELLED'
];

const orderSchema = new Schema(
  {
    // ... tumhara existing fields

    // Admin ne order accept kiya ya nahi
    isAcceptedByAdmin: {
      type: Boolean,
      default: false,
    },

    // Kab accept kiya
    acceptedAt: {
      type: Date,
      default: null,
    },

    // Admin ne kitne minutes ka prep time diya
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

// Optional transition map (agar kahi use ho)
const ALLOWED_TRANSITIONS = {
  PENDING_PAYMENT: ['CANCELLED'], // manual cancel allowed if needed
  PLACED: ['BAKING', 'CANCELLED'],
  BAKING: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: []
};

Order.canTransition = function (fromStatus, toStatus) {
  const allowed = ALLOWED_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
};

module.exports = Order;