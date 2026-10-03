const mongoose = require('mongoose');

const { Schema } = mongoose;

const categorySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    label: {
      type: String,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    icon: {
      type: String,
      trim: true
    },
    order: {
      type: Number,
      default: 0
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

categorySchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model('Category', categorySchema);