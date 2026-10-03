// src/controllers/settingsAdminController.js
const SiteSettings = require('../models/SiteSettings');

async function getOrCreateSettings() {
  let doc = await SiteSettings.findOne();
  if (!doc) {
    doc = await SiteSettings.create({});
  }
  return doc;
}

// GET /api/admin/settings/site
exports.getSiteSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    return res.json({ settings });
  } catch (err) {
    console.error('Admin getSiteSettings error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to load site settings right now.' });
  }
};

// PUT /api/admin/settings/site
exports.updateSiteSettings = async (req, res) => {
  try {
    const body = req.body || {};

    let banners = Array.isArray(body.banners) ? body.banners : [];
    banners = banners.map((b, idx) => ({
      title: (b.title || '').trim(),
      subtitle: (b.subtitle || '').trim(),
      imageUrl: (b.imageUrl || '').trim(),
      targetUrl: (b.targetUrl || '').trim(),
      isActive: b.isActive !== false,
      order:
        typeof b.order === 'number' && !Number.isNaN(b.order)
          ? b.order
          : idx
    }));

    const update = {
      siteName: body.siteName,
      logoUrl: body.logoUrl,
      faviconUrl: body.faviconUrl,
      primaryColor: body.primaryColor,
      secondaryColor: body.secondaryColor,
      heroTitle: body.heroTitle,
      heroSubtitle: body.heroSubtitle,
      heroImageUrl: body.heroImageUrl,
      heroBackgroundImageUrl: body.heroBackgroundImageUrl,
      aboutTitle: body.aboutTitle,
      aboutHtml: body.aboutHtml,
      contactPhone: body.contactPhone,
      contactEmail: body.contactEmail,
      contactAddress: body.contactAddress,
      whatsappNumber: body.whatsappNumber,
      facebookUrl: body.facebookUrl,
      instagramUrl: body.instagramUrl,
      twitterUrl: body.twitterUrl,
      footerText: body.footerText,
      maintenanceMode: !!body.maintenanceMode,
      banners
    };

    const settings = await SiteSettings.findOneAndUpdate({}, update, {
      new: true,
      upsert: true
    });

    return res.json({ settings });
  } catch (err) {
    console.error('Admin updateSiteSettings error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to save site settings right now.' });
  }
};