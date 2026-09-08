// backend/src/controllers/couponPublicController.js
const Coupon = require('../models/Coupon');

function getIstNow() {
  const now = new Date();
  return new Date(
    now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
  );
}

// GET /api/coupons/active
exports.getActiveCoupons = async (req, res) => {
  try {
    const istNow = getIstNow();
    const hour = istNow.getHours();
    const day = istNow.getDay(); // 0=Sun .. 6=Sat

    // Sab active coupons lao, JS me filter karenge
    const all = await Coupon.find({ isActive: true }).sort({
      createdAt: -1
    });

    const active = all.filter(c => {
      // Date range
      if (c.validFrom && istNow < c.validFrom) return false;
      if (c.validTo && istNow > c.validTo) return false;

      // Days of week (agar defined ho to)
      if (Array.isArray(c.daysOfWeek) && c.daysOfWeek.length > 0) {
        if (!c.daysOfWeek.includes(day)) return false;
      }

      // Time-of-day window
      if (c.startHour != null && c.startHour !== undefined) {
        if (hour < c.startHour) return false;
      }
      if (c.endHour != null && c.endHour !== undefined) {
        if (hour >= c.endHour) return false;
      }

      return true;
    });

    return res.json({ coupons: active });
  } catch (err) {
    console.error('Public getActiveCoupons error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to load active offers right now.' });
  }
};