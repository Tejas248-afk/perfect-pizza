// src/controllers/outletAdminController.js
const Outlet = require('../models/Outlet');

const DEFAULT_OUTLET_ID = process.env.DEFAULT_OUTLET_ID;

/**
 * Helper: default outlet fetch (for outlet settings)
 */
async function findDefaultOutlet() {
  if (DEFAULT_OUTLET_ID) {
    return Outlet.findById(DEFAULT_OUTLET_ID);
  }
  // Fallback: first outlet
  return Outlet.findOne({});
}

// GET /api/admin/outlet
exports.getOutletConfig = async (req, res) => {
  try {
    const outlet = await findDefaultOutlet();
    if (!outlet) {
      return res.status(404).json({ message: 'Outlet not found' });
    }

    return res.json({
      id: outlet._id,
      name: outlet.name,
      openHour: outlet.openHour,
      closeHour: outlet.closeHour,
      settings: outlet.settings
    });
  } catch (err) {
    console.error('getOutletConfig error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to load outlet config.' });
  }
};

// PUT /api/admin/outlet
exports.updateOutletConfig = async (req, res) => {
  try {
    const outlet = await findDefaultOutlet();
    if (!outlet) {
      return res.status(404).json({ message: 'Outlet not found' });
    }

    const { openHour, closeHour, enableOnlineOrders, enableBogoTuesday } =
      req.body || {};

    if (openHour != null) outlet.openHour = Number(openHour);
    if (closeHour != null) outlet.closeHour = Number(closeHour);

    if (
      outlet.settings ||
      enableOnlineOrders != null ||
      enableBogoTuesday != null
    ) {
      outlet.settings = outlet.settings || {};
      if (enableOnlineOrders != null)
        outlet.settings.enableOnlineOrders = !!enableOnlineOrders;
      if (enableBogoTuesday != null)
        outlet.settings.enableBogoTuesday = !!enableBogoTuesday;
    }

    await outlet.save();
    return res.json({ message: 'Outlet updated', outlet });
  } catch (err) {
    console.error('updateOutletConfig error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to update outlet config.' });
  }
};

// GET /api/admin/outlets
exports.listOutlets = async (req, res) => {
  try {
    const outlets = await Outlet.find({ isActive: true }).select(
      '_id name code city'
    );
    return res.json({ outlets });
  } catch (err) {
    console.error('listOutlets error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to load outlets right now.' });
  }
};

/* ========== Outlets management (Admin page) ========== */

// GET /api/admin/outlets/manage
exports.getAllOutletsAdmin = async (req, res) => {
  try {
    const outlets = await Outlet.find({}).sort({ createdAt: -1 });
    return res.json({ outlets });
  } catch (err) {
    console.error('getAllOutletsAdmin error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to load outlets for admin right now.' });
  }
};

// POST /api/admin/outlets
exports.createOutlet = async (req, res) => {
  try {
    const {
      name,
      code,
      city,
      address,
      lat,
      lng,
      deliveryRadiusKm,
      openHour,
      closeHour,
      phoneNumbers
    } = req.body || {};

    if (!name || !code || lat == null || lng == null) {
      return res.status(400).json({
        message: 'Name, Code, Latitude and Longitude are required.'
      });
    }

    const outlet = await Outlet.create({
      name: name.trim(),
      code: String(code).trim().toUpperCase(),
      city: (city || '').trim(),
      address: (address || '').trim(),
      lat: Number(lat),
      lng: Number(lng),
      deliveryRadiusKm:
        deliveryRadiusKm != null ? Number(deliveryRadiusKm) : 5,
      openHour: openHour != null ? Number(openHour) : 10,
      closeHour: closeHour != null ? Number(closeHour) : 23,
      phoneNumbers: Array.isArray(phoneNumbers)
        ? phoneNumbers
        : typeof phoneNumbers === 'string' && phoneNumbers.trim()
        ? phoneNumbers.split(',').map(p => p.trim())
        : [],
      isActive: true
    });

    return res.status(201).json({ outlet });
  } catch (err) {
    console.error('createOutlet error:', err);
    return res.status(400).json({
      message: 'Unable to create outlet.',
      error: err.message
    });
  }
};

// PUT /api/admin/outlets/:id
exports.updateOutlet = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const update = {};

    if (body.name != null) update.name = body.name.trim();
    if (body.code != null) update.code = String(body.code).trim().toUpperCase();
    if (body.city != null) update.city = body.city.trim();
    if (body.address != null) update.address = body.address.trim();

    if (body.lat != null) update.lat = Number(body.lat);
    if (body.lng != null) update.lng = Number(body.lng);
    if (body.deliveryRadiusKm != null)
      update.deliveryRadiusKm = Number(body.deliveryRadiusKm);

    if (body.openHour != null) update.openHour = Number(body.openHour);
    if (body.closeHour != null) update.closeHour = Number(body.closeHour);

    if (body.phoneNumbers != null) {
      if (Array.isArray(body.phoneNumbers)) {
        update.phoneNumbers = body.phoneNumbers;
      } else if (typeof body.phoneNumbers === 'string') {
        update.phoneNumbers = body.phoneNumbers
          .split(',')
          .map(p => p.trim())
          .filter(Boolean);
      }
    }

    if (
      body.enableOnlineOrders != null ||
      body.enableBogoTuesday != null
    ) {
      update.settings = update.settings || {};
      if (body.enableOnlineOrders != null) {
        update['settings.enableOnlineOrders'] = !!body.enableOnlineOrders;
      }
      if (body.enableBogoTuesday != null) {
        update['settings.enableBogoTuesday'] = !!body.enableBogoTuesday;
      }
    }

    const outlet = await Outlet.findByIdAndUpdate(id, update, {
      new: true
    });

    if (!outlet) {
      return res.status(404).json({ message: 'Outlet not found' });
    }

    return res.json({ outlet });
  } catch (err) {
    console.error('updateOutlet error:', err);
    return res.status(400).json({
      message: 'Unable to update outlet.',
      error: err.message
    });
  }
};

// PATCH /api/admin/outlets/:id/toggle-active
exports.toggleOutletActive = async (req, res) => {
  try {
    const { id } = req.params;
    const outlet = await Outlet.findById(id);
    if (!outlet) {
      return res.status(404).json({ message: 'Outlet not found' });
    }
    outlet.isActive = !outlet.isActive;
    await outlet.save();
    return res.json({ outlet });
  } catch (err) {
    console.error('toggleOutletActive error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to toggle outlet right now.' });
  }
};