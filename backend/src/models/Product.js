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
    // har size ka alag price (Cheese Burst etc.)
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
      // single / multiple selection
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
      // future me yahan Category model ka ref bhi de sakte hain
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