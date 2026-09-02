const Coupon = require('../models/Coupon');

// GET /api/admin/coupons
exports.getCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    return res.json({ coupons });
  } catch (err) {
    console.error('Admin getCoupons error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to load coupons right now.' });
  }
};

// POST /api/admin/coupons
exports.createCoupon = async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.code || !body.discountType || !body.amount) {
      return res.status(400).json({ message: 'Code, type & amount required.' });
    }

    body.code = String(body.code).toUpperCase().trim();

    const coupon = await Coupon.create(body);
    return res.status(201).json({ coupon });
  } catch (err) {
    console.error('Admin createCoupon error:', err);
    let message = 'Unable to create coupon.';
    if (err.code === 11000) {
      message = 'Coupon code already exists.';
    }
    return res.status(400).json({ message });
  }
};

// PUT /api/admin/coupons/:id
exports.updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    if (body.code) body.code = String(body.code).toUpperCase().trim();

    const coupon = await Coupon.findByIdAndUpdate(id, body, { new: true });
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }
    return res.json({ coupon });
  } catch (err) {
    console.error('Admin updateCoupon error:', err);
    return res.status(400).json({ message: 'Unable to update coupon.' });
  }
};

// PATCH /api/admin/coupons/:id/toggle
exports.toggleCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }
    coupon.isActive = !coupon.isActive;
    await coupon.save();
    return res.json({ coupon });
  } catch (err) {
    console.error('Admin toggleCoupon error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to toggle coupon right now.' });
  }
};