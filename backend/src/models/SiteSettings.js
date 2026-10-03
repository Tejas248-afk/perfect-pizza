const mongoose = require('mongoose');

const { Schema } = mongoose;

const bannerSchema = new Schema(
  {
    title: { type: String, trim: true },
    subtitle: { type: String, trim: true },
    imageUrl: { type: String, trim: true },
    targetUrl: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 }
  },
  { _id: false }
);

const siteSettingsSchema = new Schema(
  {
    siteName: {
      type: String,
      default: 'Perfect Pizza',
      trim: true
    },
    logoUrl: {
      type: String,
      trim: true
    },
    faviconUrl: {
      type: String,
      trim: true
    },
    primaryColor: {
      type: String,
      trim: true
    },
    secondaryColor: {
      type: String,
      trim: true
    },

    heroTitle: {
      type: String,
      trim: true
    },
    heroSubtitle: {
      type: String,
      trim: true
    },
    heroImageUrl: {
      type: String,
      trim: true
    },
    heroBackgroundImageUrl: {
      type: String,
      trim: true
    },

    aboutTitle: {
      type: String,
      trim: true
    },
    aboutHtml: {
      type: String,
      trim: true
    },

    contactPhone: {
      type: String,
      trim: true
    },
    contactEmail: {
      type: String,
      trim: true
    },
    contactAddress: {
      type: String,
      trim: true
    },
    whatsappNumber: {
      type: String,
      trim: true
    },

    facebookUrl: {
      type: String,
      trim: true
    },
    instagramUrl: {
      type: String,
      trim: true
    },
    twitterUrl: {
      type: String,
      trim: true
    },

    footerText: {
      type: String,
      trim: true
    },

    banners: [bannerSchema],

    maintenanceMode: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('SiteSettings', siteSettingsSchema);