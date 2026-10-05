// src/controllers/adminOutletController.js
const Outlet = require('../models/Outlet');

// GET /api/admin/outlets
exports.listOutlets = async (req, res, next) => {
  try {
    const outlets = await Outlet.find()
      .select('name isActive')
      .sort({ name: 1 })
      .lean();

    res.json(outlets);
  } catch (err) {
    next(err);
  }
};