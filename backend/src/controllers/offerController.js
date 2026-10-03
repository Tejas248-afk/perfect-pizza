// controllers/offerController.js
const Offer = require('../models/Offer');

exports.listOffers = async (req, res, next) => {
  try {
    const offers = await Offer.find().sort({ createdAt: -1 });
    res.json(offers);
  } catch (err) {
    next(err);
  }
};

exports.createOffer = async (req, res, next) => {
  try {
    const offer = await Offer.create(req.body);
    res.status(201).json(offer);
  } catch (err) {
    next(err);
  }
};

exports.updateOffer = async (req, res, next) => {
  try {
    const offer = await Offer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!offer) {
      return res.status(404).json({ message: 'Offer not found' });
    }
    res.json(offer);
  } catch (err) {
    next(err);
  }
};

exports.deleteOffer = async (req, res, next) => {
  try {
    const offer = await Offer.findByIdAndDelete(req.params.id);
    if (!offer) {
      return res.status(404).json({ message: 'Offer not found' });
    }
    res.json({ message: 'Offer deleted', offer });
  } catch (err) {
    next(err);
  }
};