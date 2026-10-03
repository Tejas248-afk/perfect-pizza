// src/services/offerService.js
const Offer = require('../models/Offer');

/**
 * Coupon / offer apply logic
 * params:
 *  - user: logged in user document
 *  - outlet: outlet document
 *  - subtotal: number (offerDiscount ke baad wala amount)
 *  - couponCode: string
 *
 * return:
 *  - { coupon, discount }
 *    coupon: Offer doc
 *    discount: number (₹ me)
 */
async function applyCoupon({ user, outlet, subtotal, couponCode }) {
  if (!couponCode) {
    const err = new Error('Coupon code is required');
    err.statusCode = 400;
    err.code = 'COUPON_INVALID';
    throw err;
  }

  const code = couponCode.toUpperCase().trim();
  if (!code) {
    const err = new Error('Invalid coupon code');
    err.statusCode = 400;
    err.code = 'COUPON_INVALID';
    throw err;
  }

  // 1) Offer find karo
  const offer = await Offer.findOne({
    code,
    active: true,
  });

  if (!offer) {
    const err = new Error('Coupon not found or inactive');
    err.statusCode = 404;
    err.code = 'COUPON_INVALID';
    throw err;
  }

  // 2) Validity (date range)
  const now = new Date();

  if (offer.validFrom && now < offer.validFrom) {
    const err = new Error('Coupon is not active yet');
    err.statusCode = 400;
    err.code = 'COUPON_INVALID';
    throw err;
  }

  if (offer.validTo && now > offer.validTo) {
    const err = new Error('Coupon has expired');
    err.statusCode = 400;
    err.code = 'COUPON_INVALID';
    throw err;
  }

  // 3) Weekday check (0 = Sunday ... 6 = Saturday)
  if (Array.isArray(offer.daysOfWeek) && offer.daysOfWeek.length > 0) {
    const weekday = now.getDay();
    if (!offer.daysOfWeek.includes(weekday)) {
      const err = new Error('Coupon not valid today');
      err.statusCode = 400;
      err.code = 'COUPON_INVALID';
      throw err;
    }
  }

  // 4) Min order amount
  if (
    typeof offer.minOrderAmount === 'number' &&
    subtotal < offer.minOrderAmount
  ) {
    const err = new Error(
      `Minimum order value for this coupon is ₹${offer.minOrderAmount}`
    );
    err.statusCode = 400;
    err.code = 'COUPON_INVALID';
    throw err;
  }

  // 5) First-order only
  if (offer.firstOrderOnly) {
    const orderCount = Number(user.orderCount || 0); // agar user me field ho
    if (orderCount > 0) {
      const err = new Error('Coupon valid only on first order');
      err.statusCode = 400;
      err.code = 'COUPON_INVALID';
      throw err;
    }
  }

  // 6) Inactive customers only
  if (offer.inactiveOnly) {
    // Agar user me lastOrderAt field ho to use karo,
    // agar nahi hai to abhi ke liye constraint ignore kar sakte ho.
    const lastOrderAt = user.lastOrderAt
      ? new Date(user.lastOrderAt)
      : null;
    if (lastOrderAt) {
      const diffDays =
        (now.getTime() - lastOrderAt.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays < 30) {
        const err = new Error('Coupon valid only for inactive customers');
        err.statusCode = 400;
        err.code = 'COUPON_INVALID';
        throw err;
      }
    }
  }

  // 7) Happy hour / rainy-day flags ko abhi ke liye ignore kar sakte ho
  // Future me time range / weather API se tie kar sakte ho.

  // 8) Discount calculate
  let discount = 0;

  if (offer.discountType === 'PERCENT') {
    const base = (subtotal * (offer.discountValue || 0)) / 100;
    if (offer.maxDiscount != null) {
      discount = Math.min(base, offer.maxDiscount);
    } else {
      discount = base;
    }
  } else if (offer.discountType === 'FLAT') {
    discount = offer.discountValue || 0;
  } else if (offer.discountType === 'B1G1') {
    // B1G1 ka accurate calculation order items pe depend karega
    // Abhi ke liye approximate: subtotal ka 50% cap with maxDiscount
    const approx = subtotal / 2;
    if (offer.maxDiscount != null) {
      discount = Math.min(approx, offer.maxDiscount);
    } else {
      discount = approx;
    }
  }

  discount = Math.max(0, Math.min(discount, subtotal));

  return {
    coupon: offer,
    discount: Math.round(discount),
  };
}

module.exports = {
  applyCoupon,
};