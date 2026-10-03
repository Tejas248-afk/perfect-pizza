// src/services/orderService.js
const Product = require('../models/Product');
const { applyCoupon } = require('./offerService');

// Order preview & pricing logic
// NOTE: Ye function orderController ke previewOrder & createCodOrder
// dono ke saath compatible hai.
async function buildOrderPreview({
  user,
  outlet,
  items,
  deliveryType,
  address,
  landmark,
  latitude,
  longitude,
  rewardCoinsToUse = 0,
  couponCode = '',
}) {
  if (!user) {
    const err = new Error('User is required for order preview');
    err.statusCode = 400;
    throw err;
  }
  if (!outlet) {
    const err = new Error('Outlet is required for order preview');
    err.statusCode = 400;
    throw err;
  }
  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error('At least one item is required');
    err.statusCode = 400;
    throw err;
  }

  // ---------------- Products fetch + items normalize ----------------

  const productIds = items.map((it) => it.productId);
  const products = await Product.find({ _id: { $in: productIds } });

  const productMap = {};
  products.forEach((p) => {
    productMap[String(p._id)] = p;
  });

  let subtotal = 0;

  const normalizedItems = items.map((it) => {
    const product = productMap[it.productId];
    const basePrice =
      product && typeof product.price === 'number'
        ? product.price
        : typeof product.basePrice === 'number'
        ? product.basePrice
        : 0;

    // ComboSelections se extra price add karo
    const comboSelections = Array.isArray(it.comboSelections)
      ? it.comboSelections
      : [];
    const comboExtra = comboSelections.reduce(
      (sum, cs) => sum + (cs.extraPrice || 0),
      0
    );

    // Abhi ke liye addOns ke price product se tie nahi kar raha – future improvement
    const unitPrice = basePrice + comboExtra;

    const quantity = it.quantity || 1;
    const lineTotal = unitPrice * quantity;

    subtotal += lineTotal;

    return {
      productId: it.productId,
      name: product ? product.name : 'Unknown item',
      size: it.size,
      crust: it.crust,
      quantity,
      price: unitPrice,         // per unit
      totalPrice: lineTotal,    // line total
      isVeg: product ? product.isVeg : undefined,
      addOns: Array.isArray(it.addOns) ? it.addOns : [],
      comboSelections,
    };
  });

  // ---------------- Base charges ----------------

  // Abhi ke liye outlet-specific external offers nahi laga rahe
  const offerDiscount = 0;

  // Delivery fee: outlet se read karo agar hai, warna default
  const baseDeliveryFee =
    typeof outlet.deliveryFee === 'number'
      ? outlet.deliveryFee
      : deliveryType === 'DELIVERY'
      ? 30
      : 0;

  const deliveryFee = deliveryType === 'DELIVERY' ? baseDeliveryFee : 0;

  // Tax: outlet.taxRate agar ho to use karo, warna 5%
  const taxRate =
    typeof outlet.taxRate === 'number' ? outlet.taxRate : 0.05;

  const discountedSubtotal = subtotal - offerDiscount;

  // ---------------- Coupon logic (applyCoupon) ----------------

  let couponDiscount = 0;
  let appliedCouponCode = couponCode || '';
  let appliedCouponDetails = null;

  try {
    if (couponCode && discountedSubtotal > 0) {
      const { coupon, discount } = await applyCoupon({
        user,
        outlet,
        subtotal: discountedSubtotal,
        couponCode,
      });

      couponDiscount = discount || 0;
      appliedCouponCode = coupon.code;
      appliedCouponDetails = coupon;
    }
  } catch (err) {
    const status = err.statusCode || err.status || 500;
    if (status >= 400 && status < 500) {
      console.warn(
        'Ignoring invalid coupon in buildOrderPreview:',
        err.message || err
      );
      couponDiscount = 0;
      appliedCouponCode = '';
      appliedCouponDetails = null;
    } else {
      throw err;
    }
  }

  // ---------------- Reward coins logic ----------------

  // Assume: 1 coin = ₹1
  const maxCoinsUsable = Math.max(
    0,
    Math.min(
      Number(rewardCoinsToUse || 0),
      discountedSubtotal - couponDiscount
    )
  );

  const rewardDiscount = maxCoinsUsable;
  const rewardCoinsUsed = maxCoinsUsable;

  // ---------------- Tax & grand total ----------------

  const preTaxTotal =
    discountedSubtotal - couponDiscount - rewardDiscount;
  const taxAmount = Math.round(preTaxTotal * taxRate);
  const grandTotal = Math.max(0, preTaxTotal + deliveryFee + taxAmount);

  // Reward coins earned: simple rule – ₹50 per coin
  const rewardCoinsEarned = grandTotal > 0
    ? Math.floor(grandTotal / 50)
    : 0;

  // ---------------- Delivery object ----------------

  const delivery = {
    deliveryType,
    address: address || '',
    landmark: landmark || '',
    latitude: latitude ?? null,
    longitude: longitude ?? null,
  };

  // ---------------- Return preview object ----------------

  return {
    userId: user._id,
    items: normalizedItems,
    delivery,
    subtotal,
    offerDiscount,
    deliveryFee,
    taxAmount,

    couponCode: appliedCouponCode,
    couponDiscount,
    coupon: appliedCouponDetails,

    rewardCoinsUsed,
    rewardDiscount,
    grandTotal,
    rewardCoinsEarned,
  };
}

module.exports = {
  buildOrderPreview,
};