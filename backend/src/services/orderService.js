// backend/src/services/orderService.js
const Product = require('../models/Product');
const { calculateDelivery } = require('./deliveryService');
const { calculateRewardUsage } = require('./rewardService');
const { applyCoupon } = require('./couponService');

const GST_RATE = 0.05;

function createValidationError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/**
 * Cart items ko DB Products se validate + price calculate karta hai
 */
async function calculateItemsPricing(cartItems) {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    throw createValidationError('Cart is empty');
  }

  const productIds = [...new Set(cartItems.map(i => i.productId))];

  const products = await Product.find({
    _id: { $in: productIds },
    isAvailable: true
  });

  const map = new Map(products.map(p => [String(p._id), p]));

  const orderItems = [];
  let subtotal = 0;

  for (const cartItem of cartItems) {
    const {
      productId,
      size: sizeName,
      crust: crustName,
      addOns = [],
      quantity
    } = cartItem;

    const product = map.get(String(productId));
    if (!product) {
      throw createValidationError('Some products are no longer available');
    }

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0 || qty > 20) {
      throw createValidationError('Invalid quantity for item');
    }

    const size = (product.sizes || []).find(
      s => s.name === sizeName && s.isAvailable !== false
    );
    if (!size) {
      throw createValidationError(`Invalid size selected for ${product.name}`);
    }

    const crust = (product.crusts || []).find(c => c.name === crustName);
    if (!crust) {
      throw createValidationError(`Invalid crust selected for ${product.name}`);
    }

    const crustPriceEntry = (crust.prices || []).find(
      p => p.size === size.name
    );
    if (!crustPriceEntry) {
      throw createValidationError(
        `Selected crust not available for ${size.name} size`
      );
    }

    let unitPrice = Number(size.price) + Number(crustPriceEntry.price || 0);

    const orderAddOns = [];

    for (const selected of addOns) {
      const { name, quantity: rawQty } = selected;

      const productAddOn = (product.addOns || []).find(
        a => a.name === name && a.isAvailable !== false
      );
      if (!productAddOn) {
        throw createValidationError(
          `Invalid add-on selected for ${product.name}`
        );
      }

      const addOnPriceEntry = (productAddOn.prices || []).find(
        p => p.size === size.name
      );
      if (!addOnPriceEntry) {
        throw createValidationError(
          `Add-on ${name} not available for ${size.name} size`
        );
      }

      const addOnQty = Math.max(
        1,
        Math.min(5, Number(rawQty) || 1)
      );
      const addOnPrice = Number(addOnPriceEntry.price || 0);

      unitPrice += addOnPrice * addOnQty;

      orderAddOns.push({
        name,
        price: addOnPrice,
        quantity: addOnQty
      });
    }

    const itemTotal = unitPrice * qty;
    subtotal += itemTotal;

    orderItems.push({
      product: product._id,
      productName: product.name,
      image: product.image,
      category: product.category,
      isVeg: product.isVeg,
      size: { name: size.name, price: size.price },
      crust: { name: crust.name, price: crustPriceEntry.price },
      addOns: orderAddOns,
      quantity: qty,
      unitPrice,
      itemTotal
    });
  }

  return { items: orderItems, subtotal };
}

/**
 * Complete order preview:
 * - BOGO Tuesday automatic offer (per outlet settings)
 * - Coupon discount
 * - Delivery fee (Outlet based)
 * - Reward coins
 * - 5% GST
 */
async function buildOrderPreview({
  user,
  outlet,
  items: cartItems,
  deliveryType,
  address,
  landmark,
  latitude,
  longitude,
  rewardCoinsToUse = 0,
  couponCode
}) {
  if (!user) throw createValidationError('User is required', 401);
  if (!outlet) throw createValidationError('Outlet is required', 400);

  const { items, subtotal } = await calculateItemsPricing(cartItems);

  // ---------- OFFER DISCOUNT: BOGO TUESDAY ----------
  let offerDiscount = 0;
  try {
    const now = new Date();
    const day = now.getDay(); // 2 = Tuesday

    const isTuesday = day === 2;
    if (isTuesday && outlet.settings?.enableBogoTuesday !== false) {
      for (const it of items) {
        const cat = (it.category || '').toLowerCase();
        const sizeName = it.size?.name || '';

        const eligibleCategory =
          cat.includes('exotic') ||
          cat.includes('veg special') ||
          cat.includes('pp special') ||
          cat.includes('premium pizza');

        const eligibleSize =
          sizeName === 'MEDIUM' || sizeName === 'LARGE';

        if (!eligibleCategory || !eligibleSize) continue;

        const base =
          Number(it.size?.price || 0) + Number(it.crust?.price || 0);

        const qty = Number(it.quantity || 0);
        const freeCount = Math.floor(qty / 2);

        if (freeCount > 0 && base > 0) {
          offerDiscount += base * freeCount;
        }
      }
    }
  } catch (e) {
    console.error('Offer discount calc error:', e);
  }

  if (offerDiscount < 0) offerDiscount = 0;

  let discountedSubtotal = subtotal - offerDiscount;
  if (discountedSubtotal < 0) discountedSubtotal = 0;

  // ---------- COUPON DISCOUNT ----------
  let couponDiscount = 0;
  let appliedCouponCode = '';
  try {
    if (couponCode && discountedSubtotal > 0) {
      const { coupon, discount } = await applyCoupon({
        code: couponCode,
        baseAmount: discountedSubtotal
      });
      if (coupon && discount > 0) {
        couponDiscount = discount;
        appliedCouponCode = coupon.code;
        discountedSubtotal -= couponDiscount;
        if (discountedSubtotal < 0) discountedSubtotal = 0;
      }
    }
  } catch (err) {
    throw err;
  }

  // ---------- Delivery fee ----------
  if (!deliveryType || !['DELIVERY', 'PICKUP'].includes(deliveryType)) {
    throw createValidationError('Invalid delivery type');
  }

  let deliveryInfo;
  let deliveryFee = 0;

  if (deliveryType === 'PICKUP') {
    deliveryInfo = {
      deliveryType,
      address: '',
      landmark: '',
      latitude: null,
      longitude: null,
      distance: 0
    };
  } else {
    const latNum = Number(latitude);
    const lngNum = Number(longitude);

    const { distanceKm, deliveryFee: fee } = await calculateDelivery({
      outlet,
      deliveryType,
      latitude: latNum,
      longitude: lngNum,
      subtotal: discountedSubtotal
    });

    deliveryInfo = {
      deliveryType,
      address: address || '',
      landmark: landmark || '',
      latitude: latNum,
      longitude: lngNum,
      distance: distanceKm
    };

    deliveryFee = fee;
  }

  const baseAmount = discountedSubtotal + deliveryFee;

  const reward = calculateRewardUsage({
    user,
    baseAmount,
    requestedCoins: rewardCoinsToUse
  });

  const amountAfterDiscount = baseAmount - reward.discount;

  const rawTax = amountAfterDiscount * GST_RATE;
  const taxAmount = Math.max(0, Math.round(rawTax));
  const grandTotal = amountAfterDiscount + taxAmount;

  return {
    userId: user._id,
    items,
    delivery: deliveryInfo,
    subtotal,
    offerDiscount,
    couponCode: appliedCouponCode,
    couponDiscount,
    deliveryFee,
    taxAmount,
    rewardCoinsUsed: reward.coinsUsed,
    rewardDiscount: reward.discount,
    grandTotal,
    rewardCoinsEarned: reward.rewardCoinsEarned,
    remainingRewardCoins: reward.remainingCoins
  };
}

module.exports = { buildOrderPreview, calculateItemsPricing };