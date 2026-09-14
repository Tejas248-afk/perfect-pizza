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

// Combo ke andar ke items (sirf information ke liye)
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
      // future: Category model ref
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

    // time-based availability (0–23, optional)
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

    // Agar ye COMBO product hai, to uske andar ke items yahan define kar sakte ho
    // e.g. [{ name: "Veg Burger", quantity: 1 }, { name: "Cheese Corn Pizza (Medium)", quantity: 1 }]
    comboItems: [comboSubItemSchema],

    sizes: [sizeSchema],
    crusts: [crustSchema],
    addOns: [addOnSchema]
  },
  { timestamps: true }
);

productSchema.index({ category: 1, isAvailable: 1 });

const Product = mongoose.model('Product', productSchema);

Product.SIZES = SIZE_TYPES;

module.exports = Product;