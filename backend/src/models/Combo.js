const mongoose = require('mongoose');
const { Schema } = mongoose;

const comboItemSchema = new Schema(
  {
    // Specific product reference (optional)
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: false,
    },

    // Jo naam website pe dikhana hai
    // - agar product hai to optional
    // - agar product null hai to required (Any Medium Pizza, Any Soft Drink, ...)
    productName: {
      type: String,
      trim: true,
      required: function () {
        return !this.product;
      },
    },

    size: {
      type: String, // REGULAR / MEDIUM / LARGE / 7" / ANY
      trim: true,
    },

    quantity: { type: Number, min: 1, default: 1 },

    // Display grouping: Pizza / Drink / Side / Dessert / etc.
    group: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const comboSchema = new Schema(
  {
    outlet: {
      type: Schema.Types.ObjectId,
      ref: 'Outlet',
      required: false, // future: multi-outlet filter
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

    // Ye field humne frontend me use ki hai (Show on website)
    showOnWebsite: { type: Boolean, default: true },
  },
  { timestamps: true }
);

comboSchema.index({ outlet: 1, createdAt: -1 });

module.exports = mongoose.model('Combo', comboSchema);