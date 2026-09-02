// backend/src/services/deliveryService.js
const DeliveryRule = require('../models/DeliveryRule');
const Outlet = require('../models/Outlet');
const { calculateDistanceKm } = require('../utils/distanceCalculator');

function createError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

// DEFAULT_OUTLET_ID se outlet load karne ka helper
async function getDefaultOutlet() {
  const id = process.env.DEFAULT_OUTLET_ID;
  if (!id) {
    throw createError('DEFAULT_OUTLET_ID not configured in .env', 500);
  }

  const outlet = await Outlet.findById(id);
  if (!outlet || !outlet.isActive) {
    throw createError('Default outlet is not available.', 400);
  }
  return outlet;
}

/**
 * Delivery fee + distance calculation
 * @param {Object} params
 * @param {Object} [params.outlet]  // Outlet document (optional)
 * @param {String} params.deliveryType  'DELIVERY' | 'PICKUP'
 * @param {Number} params.latitude
 * @param {Number} params.longitude
 * @param {Number} params.subtotal     // BOGO / coupon ke baad ka subtotal
 */
async function calculateDelivery({
  outlet,
  deliveryType,
  latitude,
  longitude,
  subtotal
}) {
  // PICKUP ke liye koi distance/fee nahi
  if (deliveryType === 'PICKUP') {
    return { distanceKm: 0, deliveryFee: 0 };
  }

  // Outlet resolve
  const usedOutlet = outlet || (await getDefaultOutlet());

  if (
    typeof latitude !== 'number' ||
    Number.isNaN(latitude) ||
    typeof longitude !== 'number' ||
    Number.isNaN(longitude)
  ) {
    throw createError('Valid latitude/longitude required for delivery');
  }

  const distanceKm = calculateDistanceKm(
    usedOutlet.lat,
    usedOutlet.lng,
    latitude,
    longitude
  );

  if (distanceKm > usedOutlet.deliveryRadiusKm) {
    const msg = `Delivery location is beyond maximum ${usedOutlet.deliveryRadiusKm} KM radius from ${usedOutlet.name}.`;
    const err = createError(msg);
    err.code = 'OUT_OF_RADIUS';
    err.distanceKm = distanceKm;
    throw err;
  }

  const roundedDistance = Math.round(distanceKm * 100) / 100;

  // Filhaal rules pe outlet filter optional hai (agar field added ho to use karo)
  const ruleQuery = { isActive: true };
  if (DeliveryRule.schema.paths.outlet) {
    // future me DeliveryRule me outlet field add karoge to yeh kaam karega
    ruleQuery.outlet = usedOutlet._id;
  }

  const rules = await DeliveryRule.find(ruleQuery).sort({ minDistance: 1 });

  let applicableRule = null;
  for (const rule of rules) {
    if (
      roundedDistance >= rule.minDistance &&
      roundedDistance < rule.maxDistance
    ) {
      applicableRule = rule;
      break;
    }
  }

  let deliveryFee = 0;

  if (!applicableRule) {
    console.warn(
      'No delivery rule matched for distance:',
      roundedDistance,
      'km, outlet:',
      usedOutlet.name
    );
    deliveryFee = 0;
  } else {
    if (subtotal >= applicableRule.minCartValueForFreeDelivery) {
      deliveryFee = 0;
    } else {
      deliveryFee = applicableRule.baseDeliveryFee;
    }
  }

  return { distanceKm: roundedDistance, deliveryFee };
}

module.exports = { calculateDelivery, getDefaultOutlet };