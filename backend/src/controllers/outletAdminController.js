// src/controllers/outletAdminController.js
const Outlet = require('../models/Outlet');

const DEFAULT_OUTLET_ID = process.env.DEFAULT_OUTLET_ID;

/**
 * Helper: default outlet fetch
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