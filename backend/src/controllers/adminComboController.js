// src/controllers/adminComboController.js
const Combo = require('../models/Combo');
const { logActivity } = require('../services/activityService');

// GET /api/admin/combos?outletId=...
exports.listCombos = async (req, res, next) => {
  try {
    const { outletId } = req.query;
    const query = {};
    if (outletId) query.outlet = outletId;

    const combos = await Combo.find(query)
      .sort({ createdAt: -1 })
      .lean();

    res.json(combos);
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/combos
exports.createCombo = async (req, res, next) => {
  try {
    const payload = req.body || {};
    const combo = await Combo.create(payload);

    await logActivity({
      reqUser: req.user,
      action: 'COMBO_CREATED',
      entityType: 'COMBO',
      entityId: combo._id,
      entityName: combo.name,
      after: payload,
    });

    res.status(201).json(combo);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/combos/:id
exports.updateCombo = async (req, res, next) => {
  try {
    const id = req.params.id;
    const before = await Combo.findById(id);
    if (!before) {
      return res.status(404).json({ message: 'Combo not found' });
    }

    const combo = await Combo.findByIdAndUpdate(id, req.body, {
      new: true,
    });

    await logActivity({
      reqUser: req.user,
      action: 'COMBO_UPDATED',
      entityType: 'COMBO',
      entityId: combo._id,
      entityName: combo.name,
      before,
      after: req.body,
    });

    res.json(combo);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/admin/combos/:id
exports.deleteCombo = async (req, res, next) => {
  try {
    const id = req.params.id;
    const before = await Combo.findById(id);
    if (!before) {
      return res.status(404).json({ message: 'Combo not found' });
    }

    await Combo.findByIdAndDelete(id);

    await logActivity({
      reqUser: req.user,
      action: 'COMBO_DELETED',
      entityType: 'COMBO',
      entityId: before._id,
      entityName: before.name,
      before,
    });

    res.json({ message: 'Combo deleted', combo: before });
  } catch (err) {
    next(err);
  }
};