const Coupon = require('../models/Coupon');

function isWithinDateRange(coupon, now = new Date()) {
  if (coupon.validFrom && now < coupon.validFrom) return false;
  if (coupon.validTo && now > coupon.validTo) return false;
  return true;
}

function isWithinDayAndTime(coupon, now = new Date()) {
  const hour = now.getHours();
  const dow = now.getDay(); // 0=Sun..6=Sat

  // Days
  if (Array.isArray(coupon.daysOfWeek) && coupon.daysOfWeek.length > 0) {
    if (!coupon.daysOfWeek.includes(dow)) return false;
  }

  // Time window (if both set)
  if (
    typeof coupon.startHour === 'number' &&
    typeof coupon.endHour === 'number'
  ) {
    const start = coupon.startHour;
    const end = coupon.endHour;

    // Normal case: 14→16 etc.
    if (end > start) {
      if (hour < start || hour >= end) return false;
    } else if (end < start) {
      // Overnight window e.g. 22→2
      if (hour < start && hour >= end) return false;
    }
    // if equal -> treat as all day
  }

  return true;
}

function createCouponError(message) {
  const err = new Error(message);
  err.statusCode = 400;
  err.code = 'COUPON_INVALID';
  return err;
}

/**
 * Validate coupon and calculate discount on given baseAmount
 * @param {Object} params
 * @param {String} params.code
 * @param {Number} params.baseAmount
 */
async function applyCoupon({ code, baseAmount }) {
  if (!code || !code.trim()) {
    return { coupon: null, discount: 0, message: null };
  }

  const normalized = code.trim().toUpperCase();

  const coupon = await Coupon.findOne({ code: normalized, isActive: true });
  if (!coupon) {
    throw createCouponError('Invalid or expired coupon code.');
  }

  const now = new Date();

  if (!isWithinDateRange(coupon, now)) {
    throw createCouponError('Coupon is not valid for today.');
  }

  if (!isWithinDayAndTime(coupon, now)) {
    throw createCouponError('Coupon is not valid at this time.');
  }

  const amountNum = Number(baseAmount || 0);
  if (amountNum < coupon.minCartAmount) {
    throw createCouponError(
      `Minimum cart value ₹${coupon.minCartAmount} required for this coupon.`
    );
  }

  let discount = 0;
  if (coupon.discountType === 'PERCENT') {
    discount = (amountNum * coupon.amount) / 100;
  } else {
    discount = coupon.amount;
  }

  if (coupon.maxDiscount && discount > coupon.maxDiscount) {
    discount = coupon.maxDiscount;
  }

  if (discount < 0) discount = 0;
  if (discount > amountNum) discount = amountNum;

  return {
    coupon,
    discount
  };
}

module.exports = {
  applyCoupon
};