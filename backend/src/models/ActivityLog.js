// src/models/ActivityLog.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const activityLogSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, trim: true },
    userRole: { type: String, trim: true },

    action: { type: String, required: true, trim: true }, // e.g. PRODUCT_PRICE_UPDATED
    entityType: { type: String, trim: true },             // PRODUCT / ORDER / OFFER / USER etc.
    entityId: { type: String, trim: true },               // String rakha hai (ObjectId ya custom id dono chal jayenge)
    entityName: { type: String, trim: true },

    before: { type: Schema.Types.Mixed }, // optional snapshot
    after: { type: Schema.Types.Mixed },  // optional snapshot
    meta: { type: Schema.Types.Mixed },   // additional info (e.g. { reason: 'manual cancel' })
  },
  { timestamps: true }
);

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ entityType: 1, entityId: 1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);