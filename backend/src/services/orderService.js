// src/services/orderService.js
const Product = require('../models/Product');
const { calculateDelivery } = require('./deliveryService');
const { calculateRewardUsage } = require('./rewardService');
const { applyCoupon } = require('./couponService');

const GST_RATE = 0.05;

// Hard-coded combo breakdown (agar DB me comboItems na ho)
const COMBO_ITEMS_MAP = {
  // Yahan apne combo products ke EXACT name daalo:
  'Burger Pizza Combo': [
    { name: 'Veg Burger', quantity: 1 },
    { name: 'Cheese Corn Pizza (Regular)', quantity: 1 },
    { name: 'Coke 500ml', quantity: 1 }
  ]

  // Example dusra combo (agar ho):
  // 'Family Feast Combo': [
  //   { name: 'Margherita Pizza (Medium)', quantity: 1 },
  //   { name: 'Veg Burger', quantity: 2 },
  //   { name: 'Garlic Bread', quantity: 1 },
  //   { name: 'Cold Drink 1.25L', quantity: 1 }
  // ]
};

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
      quantity,
      // NEW: frontend se aane wala combo detail
      comboSelections: rawComboSelections = []
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

      const addOnQty = Math.max(1, Math.min(5, Number(rawQty) || 1));
      const addOnPrice = Number(addOnPriceEntry.price || 0);

      unitPrice += addOnPrice * addOnQty;

      orderAddOns.push({
        name,
        price: addOnPrice,
        quantity: addOnQty
      });
    }

    // NEW: comboSelections ko normalize karo (sirf store/display ke liye)
    const normalizedSelections = Array.isArray(rawComboSelections)
      ? rawComboSelections.map(sel => ({
          groupKey: sel.groupKey || '',
          groupTitle: sel.groupTitle || sel.groupKey || '',
          label: sel.label || '',
          extraPrice: Number(sel.extraPrice || 0)
        }))
      : [];

    // NOTE: Yahan hum extraPrice ko unitPrice me ADD nahi kar rahe,
    // kyunki combo ka total base price already product me set hota hai.
    // Agar baad me zarurat ho to yahan se adjust kar sakte ho.

    const itemTotal = unitPrice * qty;
    subtotal += itemTotal;

    // Combo items: pehle DB se lo, agar nahi to COMBO_ITEMS_MAP se
    let comboItems = Array.isArray(product.comboItems)
      ? product.comboItems
      : [];

    if (!comboItems.length && COMBO_ITEMS_MAP[product.name]) {
      comboItems = COMBO_ITEMS_MAP[product.name];
    }

    orderItems.push({
      product: product._id,
      productName: product.name,
      image: product.image,
      category: product.category,
      isVeg: product.isVeg,

      comboItems,                // purana static combo breakdown
      comboSelections: normalizedSelections, // NEW: exact user selections

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
 * - BOGO Tuesday automatic offer
 * - Coupon discount
 * - Delivery fee
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
  let bogoFreeCount = 0;
  try {
    const now = new Date();
    const istNow = new Date(
      now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
    );
    const day = istNow.getDay(); // 2 = Tuesday
    const hour = istNow.getHours();

    const isTuesday = day === 2;
    const openHour = 10;
    const closeHour = 23;

    const isWithinBogoTime = hour >= openHour && hour < closeHour;

    if (
      isTuesday &&
      isWithinBogoTime &&
      outlet.settings?.enableBogoTuesday !== false
    ) {
      const eligibleBases = [];

      for (const it of items) {
        const cat = (it.category || '').toLowerCase();
        const sizeName = (it.size?.name || '').toUpperCase();

        const eligibleCategory =
          cat.includes('exotic') || cat.includes('veg special');
        const eligibleSize =
          sizeName === 'MEDIUM' || sizeName === 'LARGE';

        if (!eligibleCategory || !eligibleSize) continue;

        const base =
          Number(it.size?.price || 0) + Number(it.crust?.price || 0);
        const qty = Number(it.quantity || 0);

        if (base <= 0 || qty <= 0) continue;

        for (let i = 0; i < qty; i++) {
          eligibleBases.push(base);
        }
      }

      const totalEligibleQty = eligibleBases.length;
      const freeCount = Math.floor(totalEligibleQty / 2);

      if (freeCount > 0) {
        bogoFreeCount = freeCount;
        eligibleBases.sort((a, b) => a - b);
        for (let i = 0; i < freeCount; i++) {
          offerDiscount += eligibleBases[i];
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
    // coupon error ko upper controller handle karega (400 ya jo bhi)
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
    remainingRewardCoins: reward.remainingCoins,
    bogoFreeCount
  };
}

module.exports = { buildOrderPreview, calculateItemsPricing };