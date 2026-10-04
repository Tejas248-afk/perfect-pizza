// src/services/orderService.js
const Product = require('../models/Product');
const { applyCoupon } = require('./offerService');

// Order preview & pricing logic
// OrderController ke previewOrder & createCodOrder dono ke saath compatible
async function buildOrderPreview({
  user,
  outlet,
  items,            // cart items from frontend
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

  // --------- Products fetch ----------

  const productIds = items.map((it) => it.productId);
  const products = await Product.find({ _id: { $in: productIds } });

  const productMap = {};
  products.forEach((p) => {
    productMap[String(p._id)] = p;
  });

  let subtotal = 0;

  // --------- Items normalize (match Order.orderItemSchema) ----------

  const normalizedItems = items.map((it) => {
    const product = productMap[it.productId];

    if (!product) {
      const err = new Error('Product not found for cart item');
      err.statusCode = 400;
      throw err;
    }

    const quantity = it.quantity || 1;

    // Base price – yahan tum apni Product schema ke hisaab se tweak kar sakte ho
    let basePrice = 0;
    if (typeof product.price === 'number') {
      basePrice = product.price;
    } else if (typeof product.basePrice === 'number') {
      basePrice = product.basePrice;
    } else if (Array.isArray(product.sizes) && product.sizes.length > 0) {
      // agar product.sizes hai, to default pehli size ka price
      const prices = product.sizes
        .map((s) => s.price)
        .filter((x) => typeof x === 'number');
      if (prices.length > 0) basePrice = prices[0];
    }

    // ComboSelections se extra price add karo
    const comboSelections = Array.isArray(it.comboSelections)
      ? it.comboSelections
      : [];
    const comboExtra = comboSelections.reduce(
      (sum, cs) => sum + (cs.extraPrice || 0),
      0
    );

    // Abhi ke liye addOns ka extra price product se tie nahi kar rahe
    // (agar frontend se price aata ho to yahaan add kar sakte ho)
    const addOns = Array.isArray(it.addOns) ? it.addOns : [];
    const mappedAddOns = addOns.map((a) => ({
      name: a.name,
      quantity: a.quantity || 1,
      price: a.price || 0,
    }));

    const unitPrice = basePrice + comboExtra;
    const itemTotal = unitPrice * quantity;

    subtotal += itemTotal;

    // size / crust normalisation
    const sizeNameRaw = it.size || 'REGULAR';
    const sizeName = String(sizeNameRaw).toUpperCase(); // REGULAR/MEDIUM/LARGE etc.

    const crustName = it.crust || '';

    return {
      product: product._id,                            // required
      productName: product.name,
      image: product.imageUrl || product.image || '',
      category: product.category || '',
      isVeg: product.isVeg,

      comboItems: [],                                  // legacy empty
      comboSelections,                                 // new structure

      size: {
        name: sizeName,
        price: basePrice,                              // base price tie kar diya
      },

      crust: {
        name: crustName,
        price: 0,                                      // agar crust extra price ho to yahan set karo
      },

      addOns: mappedAddOns,

      quantity,                                        // required
      unitPrice,                                       // required
      itemTotal,                                       // required

      notes: it.notes || '',
    };
  });

  // ---------------- Base charges ----------------

  const offerDiscount = 0; // abhi koi auto offer nahi

  // Delivery fee: outlet.deliveryFee ya default
  const baseDeliveryFee =
    typeof outlet.deliveryFee === 'number'
      ? outlet.deliveryFee
      : deliveryType === 'DELIVERY'
      ? 30
      : 0;

  const deliveryFee = deliveryType === 'DELIVERY' ? baseDeliveryFee : 0;

  // Tax: outlet.taxRate ya 5%
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
  const rewardCoinsEarned =
    grandTotal > 0 ? Math.floor(grandTotal / 50) : 0;

  // ---------------- Delivery object (Order.deliverySchema) ----------------

  const delivery = {
    deliveryType, // required by schema
    address: address || '',
    landmark: landmark || '',
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    distance: null,              // future: calculate based on outlet + user coords
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