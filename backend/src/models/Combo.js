// src/models/Combo.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const comboItemSchema = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    productName: String,
    size: String,              // REGULAR / MEDIUM / LARGE / 7" / ANY
    quantity: { type: Number, min: 1, default: 1 },
    group: String,             // Pizza / Drink / Side / Dessert (optional)
  },
  { _id: false }
);

const comboSchema = new Schema(
  {
    outlet: {
      type: Schema.Types.ObjectId,
      ref: 'Outlet',
      required: false,         // future: multi-outlet filter
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },

    items: {
      type: [comboItemSchema],
      validate: (v) => Array.isArray(v) && v.length > 0,
    },

    regularPrice: { type: Number, min: 0 },
    comboPrice: { type: Number, min: 0, required: true },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

comboSchema.index({ outlet: 1, createdAt: -1 });

module.exports = mongoose.model('Combo', comboSchema);