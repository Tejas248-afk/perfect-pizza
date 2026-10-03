// src/models/Product.js
const mongoose = require('mongoose');

const { Schema } = mongoose;

const SIZE_TYPES = ['REGULAR', 'MEDIUM', 'LARGE'];

const sizeSchema = new Schema(
  {
    name: {
      type: String,
      enum: SIZE_TYPES,
      required: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    isAvailable: {
      type: Boolean,
      default: true
    }
  },
  { _id: false }
);

const crustPriceSchema = new Schema(
  {
    size: {
      type: String,
      enum: SIZE_TYPES,
      required: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    }
  },
  { _id: false }
);

const crustSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    isAvailable: {
      type: Boolean,
      default: true
    },
    prices: [crustPriceSchema]
  },
  { _id: false }
);

const addOnPriceSchema = new Schema(
  {
    size: {
      type: String,
      enum: SIZE_TYPES,
      required: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    }
  },
  { _id: false }
);

const addOnSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    isRequired: {
      type: Boolean,
      default: false
    },
    multiple: {
      type: Boolean,
      default: true
    },
    isAvailable: {
      type: Boolean,
      default: true
    },
    prices: [addOnPriceSchema]
  },
  { _id: false }
);

const comboSubItemSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
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

const productSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    image: {
      type: String,
      trim: true
    },
    isVeg: {
      type: Boolean,
      default: true
    },
    isAvailable: {
      type: Boolean,
      default: true
    },

    availableFromHour: {
      type: Number,
      min: 0,
      max: 23
    },
    availableToHour: {
      type: Number,
      min: 0,
      max: 23
    },

    comboItems: [comboSubItemSchema],

    sizes: [sizeSchema],
    crusts: [crustSchema],
    addOns: [addOnSchema],

    // IMPORTANT: yahi field admin combo edit ko DB me save karega
    comboConfig: {
      type: Schema.Types.Mixed,
      default: null
    },

    displayOrder: {
      type: Number,
      default: 0
    },

    dailyDisabledUntil: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

productSchema.index({ category: 1, isAvailable: 1 });
productSchema.index({ category: 1, displayOrder: 1 });

const Product = mongoose.model('Product', productSchema);
Product.SIZES = SIZE_TYPES;

module.exports = Product;