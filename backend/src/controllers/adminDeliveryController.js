// src/controllers/adminDeliveryController.js
const DeliveryZone = require('../models/DeliveryZone');

exports.listZones = async (req, res, next) => {
  try {
    const zones = await DeliveryZone.find().sort({ createdAt: -1 });
    res.json(zones);
  } catch (err) {
    next(err);
  }
};

exports.createZone = async (req, res, next) => {
  try {
    const zone = await DeliveryZone.create(req.body);
    res.status(201).json(zone);
  } catch (err) {
    next(err);
  }
};

exports.updateZone = async (req, res, next) => {
  try {
    const zone = await DeliveryZone.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!zone) {
      return res.status(404).json({ message: 'Delivery zone not found' });
    }
    res.json(zone);
  } catch (err) {
    next(err);
  }
};

exports.deleteZone = async (req, res, next) => {
  try {
    const zone = await DeliveryZone.findByIdAndDelete(req.params.id);
    if (!zone) {
      return res.status(404).json({ message: 'Delivery zone not found' });
    }
    res.json({ message: 'Delivery zone deleted', zone });
  } catch (err) {
    next(err);
  }
};